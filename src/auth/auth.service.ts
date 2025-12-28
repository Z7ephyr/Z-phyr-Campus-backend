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

  // ===========================
  // LOGIN
  // ===========================
  async login(
    loginDto: LoginDto,
    ipAddress: string,
  ): Promise<AuthResponseDto> {
    const { student_id, password } = loginDto;

    const user = await this.usersService.findByStudentId(student_id);

    // Account locked check
    if (user?.status === UserStatus.LOCKED) {
      if (user.locked_until && new Date() < user.locked_until) {
        await this.logLoginAttempt(
          student_id,
          ipAddress,
          false,
          user.id,
          'Account locked',
        );
        throw new UnauthorizedException(
          `Account is locked until ${user.locked_until.toLocaleString()}`,
        );
      }

      user.status = UserStatus.ACTIVE;
      user.failed_login_attempts = 0;
      user.locked_until = null;
      await this.userRepository.save(user);
    }

    // Password validation
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      await this.handleFailedLogin(student_id, ipAddress, user?.id);
      throw new UnauthorizedException('Invalid student ID or password');
    }

    // Status check
    if (user.status !== UserStatus.ACTIVE) {
      await this.logLoginAttempt(
        student_id,
        ipAddress,
        false,
        user.id,
        `Status: ${user.status}`,
      );
      throw new UnauthorizedException(`Account is ${user.status}`);
    }

    // Reset failed attempts
    if (user.failed_login_attempts > 0) {
      user.failed_login_attempts = 0;
      await this.userRepository.save(user);
    }

    await this.logLoginAttempt(student_id, ipAddress, true, user.id);

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
        full_name: userWithProfile?.profile?.full_name ?? '',
      },
    };
  }

  // ===========================
  // TOKEN GENERATION
  // ===========================
  private async generateTokens(user: User) {
    const payload = {
      sub: user.id,
      studentId: user.student_id,
      role: user.role,
    };

    const access_token = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: Number(
        this.configService.getOrThrow<string>('JWT_ACCESS_EXPIRATION'),
      ),
    });

    const refresh_token = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: Number(
        this.configService.getOrThrow<string>('JWT_REFRESH_EXPIRATION'),
      ),
    });

    await this.storeRefreshToken(user.id, refresh_token);

    return { access_token, refresh_token };
  }

  // ===========================
  // STORE REFRESH TOKEN
  // ===========================
  private async storeRefreshToken(
    userId: string,
    token: string,
  ): Promise<void> {
    const tokenHash = await bcrypt.hash(token, 10);

    const expiresAt = new Date();
    expiresAt.setSeconds(
      expiresAt.getSeconds() +
        Number(this.configService.getOrThrow('JWT_REFRESH_EXPIRATION')),
    );

    const refreshToken = this.refreshTokenRepository.create({
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    await this.refreshTokenRepository.save(refreshToken);
  }

  // ===========================
  // REFRESH ACCESS TOKEN
  // ===========================
  async refreshAccessToken(
    refreshToken: string,
  ): Promise<{ access_token: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.usersService.findById(payload.sub);
      if (!user) throw new UnauthorizedException();

      const tokens = await this.refreshTokenRepository.find({
        where: { user_id: user.id, is_revoked: false },
      });

      const valid = await Promise.any(
        tokens.map((t) => bcrypt.compare(refreshToken, t.token_hash)),
      ).catch(() => false);

      if (!valid) throw new UnauthorizedException();

      const access_token = this.jwtService.sign(
        {
          sub: user.id,
          studentId: user.student_id,
          role: user.role,
        },
        {
          secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
          expiresIn: Number(
            this.configService.getOrThrow<string>('JWT_ACCESS_EXPIRATION'),
          ),
        },
      );

      return { access_token };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  // ===========================
  // LOGOUT
  // ===========================
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

  // ===========================
  // FAILED LOGIN HANDLING
  // ===========================
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

  // ===========================
  // LOGIN ATTEMPT LOG
  // ===========================
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
