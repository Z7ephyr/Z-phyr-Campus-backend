import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('login_attempts')
export class LoginAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50 })
  student_id: string;

  @Column({ type: 'uuid', nullable: true })
  user_id: string;

  @Column({ length: 45 })
  ip_address: string;

  @Column({ default: false })
  success: boolean;

  @Column({ type: 'text', nullable: true })
  failure_reason: string;

  @CreateDateColumn()
  attempted_at: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.login_attempts, { 
    onDelete: 'CASCADE' 
  })
  @JoinColumn({ name: 'user_id' })
  user: User;
}