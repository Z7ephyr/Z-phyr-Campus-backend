import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole, UserStatus } from '../users/entities/user.entity';
import { UserProfile } from '../users/entities/user-profile.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5433,
  username: 'postgres',
  password: '02hero',
  database: 'zephyr_campus_db',
  entities: [__dirname + '/../**/*.entity.{ts,js}'],
  synchronize: false, // ⚠️ never true in prod
});

async function seed() {
  await AppDataSource.initialize();

  const userRepository = AppDataSource.getRepository(User);
  const profileRepository = AppDataSource.getRepository(UserProfile);

  console.log('🌱 Seeding database...');

  const students = [
    {
      student_id: 'ETU001',
      email: 'ahmed.ben@zephyr.tn',
      password: 'password123',
      full_name: 'Ahmed Ben Ali',
      cin: '12345678',
      nationality: 'Tunisienne',
      phone: '+216 98 123 456',
      group_name: 'L3-INFO-A',
      sub_group: 'Groupe 1',
    },
    {
      student_id: 'ETU002',
      email: 'fatma.salem@zephyr.tn',
      password: 'password123',
      full_name: 'Fatma Salem',
      cin: '87654321',
      nationality: 'Tunisienne',
      phone: '+216 97 654 321',
      group_name: 'L3-INFO-A',
      sub_group: 'Groupe 1',
    },
    {
      student_id: 'ETU003',
      email: 'mohamed.triki@zephyr.tn',
      password: 'password123',
      full_name: 'Mohamed Triki',
      cin: '11223344',
      nationality: 'Tunisienne',
      phone: '+216 55 112 233',
      group_name: 'L3-INFO-B',
      sub_group: 'Groupe 2',
    },
  ];

  for (const student of students) {
    const existingUser = await userRepository.findOne({
      where: { student_id: student.student_id },
    });

    if (existingUser) {
      console.log(`⏭️  ${student.student_id} already exists`);
      continue;
    }

    const passwordHash = await bcrypt.hash(student.password, 10);

    const user = userRepository.create({
      student_id: student.student_id,
      email: student.email,
      password_hash: passwordHash,
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
    });

    await userRepository.save(user);

    const profile = profileRepository.create({
      user_id: user.id,
      full_name: student.full_name,
      cin: student.cin,
      nationality: student.nationality,
      phone: student.phone,
      group_name: student.group_name,
      sub_group: student.sub_group,
      date_of_birth: new Date('2000-01-01'),
      address: 'Tunis, Tunisie',
    });

    await profileRepository.save(profile);

    console.log(`✅ Created ${student.student_id} (${student.full_name})`);
  }

  console.log('🎉 Seeding completed!');
  await AppDataSource.destroy();
  process.exit(0);
}

seed().catch((error) => {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
});
