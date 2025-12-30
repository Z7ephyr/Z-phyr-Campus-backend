import { IsEmail, IsNotEmpty, IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ProfileDto {
  @IsNotEmpty()
  @IsString()
  full_name: string;

  @IsNotEmpty()
  @IsString()
  group_name: string;

  @IsString()
  sub_group?: string;
}

export class CreateStudentDto {
  @IsNotEmpty()
  @IsString()
  student_id: string;

  @IsEmail()
  email: string;

  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ValidateNested()
  @Type(() => ProfileDto)
  profile: ProfileDto;
}