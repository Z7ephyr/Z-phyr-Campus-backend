import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserProfile } from './entities/user-profile.entity';
import { UsersService } from './users.service';
import { StudentsController } from './students.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserProfile])],
  controllers: [StudentsController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}