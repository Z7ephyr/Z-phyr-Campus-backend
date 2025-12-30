import { Controller, Get, Post, Body, UseGuards, Param, Query,Delete,Patch } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator'; 
import { UsersService } from './users.service';
import { UserRole, UserStatus } from './entities/user.entity';
import { CreateStudentDto } from '../auth/dto/create-student.dto';
import { UpdateStudentDto } from '../auth/dto/update-student.dto';

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentsController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async findAll(
    @Query('search') search?: string,
    @Query('group') group?: string,
    @Query('status') status?: UserStatus,
  ) {
   
    return this.usersService.findAllStudents(search, group, status);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async findOne(@Param('id') id: string) {
    return this.usersService.findByIdWithProfile(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async create(@Body() createStudentDto: CreateStudentDto) {

    return this.usersService.createStudent(createStudentDto);
  }
  @Delete(':id')
@Roles(UserRole.ADMIN)
async remove(@Param('id') id: string) {
  return this.usersService.deleteStudent(id);
}


@Patch(':id/status')
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
async changeStatus(
  @Param('id') id: string, 
  @Body('status') status: UserStatus 
) {
  console.log(`--- DEBUG PATCH --- ID: ${id}, Status reçu: ${status}`);
  
  if (!status) {
    console.error("ERREUR: Le statut reçu est undefined !");
  }
  return await this.usersService.updateStatus(id, status);
}
@Patch(':id')
@Roles(UserRole.ADMIN)
async update(@Param('id') id: string, @Body() updateData: UpdateStudentDto) {
  return this.usersService.updateStudent(id, updateData);
}
}