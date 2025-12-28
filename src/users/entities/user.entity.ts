import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { UserProfile } from './user-profile.entity';
import { RefreshToken } from '../../auth/entities/refresh-token.entity';
import { LoginAttempt } from '../../auth/entities/login-attempt.entity';

export enum UserRole {
  STUDENT = 'student',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
}

export enum UserStatus {
  ACTIVE = 'active',
  LOCKED = 'locked',
  PENDING = 'pending',
  SUSPENDED = 'suspended',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 50 })
  student_id: string;

  @Column({ unique: true, length: 100 })
  email: string;

  @Column({ length: 255 })
  password_hash: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.STUDENT,
  })
  role: UserRole;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @Column({ default: 0 })
  failed_login_attempts: number;
  
@Column({ type: 'timestamp', nullable: true })
locked_until: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @OneToOne(() => UserProfile, (profile) => profile.user)
  profile: UserProfile;

  @OneToMany(() => RefreshToken, (token) => token.user)
  refresh_tokens: RefreshToken[];

  @OneToMany(() => LoginAttempt, (attempt) => attempt.user)
  login_attempts: LoginAttempt[];
}