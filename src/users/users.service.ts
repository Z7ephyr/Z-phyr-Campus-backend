import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async findByStudentId(studentId: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { student_id: studentId },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
    });
  }

  async findByIdWithProfile(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
      relations: ['profile'],
    });
  }
}