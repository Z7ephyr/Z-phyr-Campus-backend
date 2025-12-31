import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { User, UserStatus } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { LoginAttempt } from './entities/login-attempt.entity';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,

    @InjectRepository(LoginAttempt)
    private readonly loginAttemptRepository: Repository<LoginAttempt>,

    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  async login(
    loginDto: LoginDto,
    ipAddress: string,
  ): Promise<AuthResponseDto> {
    const { email: identifier, password } = loginDto;
    
    let user: User | null = null;

   
    if (identifier.includes('@')) {
     
      user = await this.usersService.findOneByEmail(identifier);
    } else {
     
      user = await this.usersService.findByStudentId(identifier);
    }

 
    if (!user) {
      await this.logLoginAttempt(identifier, ipAddress, false, undefined, 'User not found');
     
      throw new UnauthorizedException('Identifiants invalides');
    }

   
    if (user.status === UserStatus.LOCKED && user.locked_until) {
      if (new Date() < user.locked_until) {
        await this.logLoginAttempt(
          identifier,
          ipAddress,
          false,
          user.id,
          'Account locked (temporary)',
        );
        throw new UnauthorizedException(
          `Compte verrouillé temporairement. Réessayez après ${user.locked_until.toLocaleString()}`,
        );
      }
      
      
      user.status = UserStatus.ACTIVE;
      user.failed_login_attempts = 0;
      user.locked_until = null;
      await this.userRepository.save(user);
    }

   
    if (user.status !== UserStatus.ACTIVE) {
      await this.logLoginAttempt(
        identifier,
        ipAddress,
        false,
        user.id,
        `Access denied: status is ${user.status}`,
      );
      throw new UnauthorizedException(
        `Accès refusé. Votre compte est actuellement ${user.status}.`,
      );
    }

    
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      await this.handleFailedLogin(identifier, ipAddress, user.id);
      throw new UnauthorizedException('Identifiants invalides');
    }

  
    if (user.failed_login_attempts > 0) {
      user.failed_login_attempts = 0;
      user.locked_until = null;
      await this.userRepository.save(user);
    }

    await this.logLoginAttempt(identifier, ipAddress, true, user.id);

    
    const tokens = await this.generateTokens(user);
    const userWithProfile = await this.usersService.findByIdWithProfile(user.id);

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      user: {
        id: user.id,
        student_id: user.student_id,
        email: user.email,
        role: user.role,
        full_name: userWithProfile?.profile?.full_name ?? 'Étudiant',
      },
    };
  }
  private async generateTokens(user: User) {
    const payload = {
      sub: user.id,
      studentId: user.student_id,
      role: user.role,
    };

    const access_token = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: '24h',
    });

    const refresh_token = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });

    await this.storeRefreshToken(user.id, refresh_token);

    return { access_token, refresh_token };
  }

  private async storeRefreshToken(
    userId: string,
    token: string,
  ): Promise<void> {
    const tokenHash = await bcrypt.hash(token, 10);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const refreshToken = this.refreshTokenRepository.create({
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    await this.refreshTokenRepository.save(refreshToken);
  }

  async refreshAccessToken(
    refreshToken: string,
  ): Promise<{ access_token: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.usersService.findById(payload.sub);
      if (!user) throw new UnauthorizedException();

      const tokens = await this.refreshTokenRepository.find({
        where: { user_id: user.id, is_revoked: false },
      });

      let valid = false;
      for (const t of tokens) {
        if (await bcrypt.compare(refreshToken, t.token_hash)) {
          valid = true;
          break;
        }
      }

      if (!valid) throw new UnauthorizedException();

      const access_token = this.jwtService.sign(
        {
          sub: user.id,
          studentId: user.student_id,
          role: user.role,
        },
        {
          secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
          expiresIn: '24h',
        },
      );

      return { access_token };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    const tokens = await this.refreshTokenRepository.find({
      where: { user_id: userId, is_revoked: false },
    });

    for (const token of tokens) {
      if (await bcrypt.compare(refreshToken, token.token_hash)) {
        token.is_revoked = true;
        await this.refreshTokenRepository.save(token);
      }
    }
  }

  private async handleFailedLogin(
    studentId: string,
    ipAddress: string,
    userId?: string,
  ): Promise<void> {
    await this.logLoginAttempt(
      studentId,
      ipAddress,
      false,
      userId,
      'Invalid credentials',
    );

    if (!userId) return;

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) return;

    user.failed_login_attempts++;

    if (user.failed_login_attempts >= 5) {
      user.status = UserStatus.LOCKED;
      user.locked_until = new Date(Date.now() + 15 * 60 * 1000);
    }

    await this.userRepository.save(user);
  }

  private async logLoginAttempt(
    studentId: string,
    ipAddress: string,
    success: boolean,
    userId?: string,
    failureReason?: string,
  ): Promise<void> {
    const attempt = this.loginAttemptRepository.create({
      student_id: studentId,
      user_id: userId,
      ip_address: ipAddress,
      success,
      failure_reason: failureReason,
    });

    await this.loginAttemptRepository.save(attempt);
  }
}