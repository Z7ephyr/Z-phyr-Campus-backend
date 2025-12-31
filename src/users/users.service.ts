import { 
  Injectable, 
  NotFoundException, 
  ConflictException, 
  BadRequestException 
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { User, UserRole, UserStatus } from './entities/user.entity';
import { UserProfile } from './entities/user-profile.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,

    @InjectRepository(UserProfile)
    private userProfileRepository: Repository<UserProfile>,

    private dataSource: DataSource,
  ) {}

  async findByStudentId(studentId: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { student_id: studentId } });
  }

  async findOneByEmail(email: string): Promise<User | null> {
    if (!email) return null;
  
    return this.userRepository.findOne({ 
      where: { 
        email: email.toLowerCase().trim() 
      } 
    });
  }
  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async findByIdWithProfile(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
      relations: ['profile'],
    });
  }

  async findAllStudents(search?: string, group?: string, status?: UserStatus): Promise<User[]> {
    const query = this.userRepository.createQueryBuilder('user')
      .leftJoinAndSelect('user.profile', 'profile')
      .where('user.role = :role', { role: UserRole.STUDENT });
  
    if (search) {
      query.andWhere('(user.student_id ILIKE :search OR profile.full_name ILIKE :search)', 
        { search: `%${search}%` });
    }
  
    if (group && group !== 'all') {
      query.andWhere('profile.group_name = :group', { group });
    }
  
    if (status && status !== ('all' as any)) {
      query.andWhere('user.status = :status', { status });
    }
  
    return query.getMany();
  }

  async createStudent(data: any) {
    const existingUser = await this.userRepository.findOne({
      where: [{ student_id: data.student_id }, { email: data.email }]
    });
  
    if (existingUser) {
      const field = existingUser.email === data.email ? 'Email' : 'Matricule';
      throw new ConflictException(`${field} déjà utilisé.`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const hashedPassword = await bcrypt.hash(data.password, 10);
      const user = queryRunner.manager.create(User, {
        student_id: data.student_id,
        email: data.email,
        password_hash: hashedPassword,
        role: UserRole.STUDENT, 
        status: UserStatus.ACTIVE,
      });
      const savedUser = await queryRunner.manager.save(user);

      const profile = queryRunner.manager.create(UserProfile, {
        ...data.profile,
        user_id: savedUser.id, 
      });
      await queryRunner.manager.save(profile);

      await queryRunner.commitTransaction();
      return this.findByIdWithProfile(savedUser.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException("Erreur lors de la création.");
    } finally {
      await queryRunner.release();
    }
  }


  async updateStudent(id: string, updateData: any) {
    const user = await this.userRepository.findOne({ 
      where: { id },
      relations: ['profile'] 
    });
  
    if (!user) throw new NotFoundException('Étudiant introuvable');
  
   
    if (updateData.email) user.email = updateData.email;
    if (updateData.student_id) user.student_id = updateData.student_id;
    
    if (updateData.status) {
      user.status = updateData.status;
      if (updateData.status === UserStatus.ACTIVE) {
        user.failed_login_attempts = 0;
        user.locked_until = null;
      }
    }
  
    if (updateData.profile && user.profile) {
      Object.assign(user.profile, updateData.profile);
      await this.userProfileRepository.save(user.profile);
    }
  
    return await this.userRepository.save(user);
  }

  async deleteStudent(id: string) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`L'étudiant n'existe pas.`);
    try {
      return await this.userRepository.remove(user);
    } catch (error) {
      throw new BadRequestException("Suppression impossible : l'étudiant est lié à d'autres données.");
    }
  }

  async updateStatus(id: string, status: UserStatus) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`Étudiant introuvable.`);
  
    user.status = status;

   
    if (status === UserStatus.ACTIVE) {
      user.failed_login_attempts = 0;
      user.locked_until = null;
    }

    return this.userRepository.findOne({ where: { id } });
  }
}