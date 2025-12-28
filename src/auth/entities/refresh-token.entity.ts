import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'text' })
  token_hash: string;

  @Column({ type: 'timestamp' })
  expires_at: Date;

  @Column({ default: false })
  is_revoked: boolean;

  @CreateDateColumn()
  created_at: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.refresh_tokens)
  @JoinColumn({ name: 'user_id' })
  user: User;
}