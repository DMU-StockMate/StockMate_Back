import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../../users/entities/user.entity';

import { MailService } from './mail.service';

import { SendEmailCodeDto } from '../dto/send-email-code.dto';
import { VerifyEmailCodeDto } from '../dto/verify-email-code.dto';

@Injectable()
export class EmailVerificationService {
  constructor(
    @InjectRedis()
    private readonly redis: Redis,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly mailService: MailService,
  ) {}

  private generateEmailCode(): string {
    return Math.floor(
      100000 + Math.random() * 900000,
    ).toString();
  }

  private getEmailCodeKey(
    email: string,
    purpose: 'REGISTER' | 'RESET_PASSWORD',
  ): string {
    return `email_verify:${purpose}:${email}`;
  }

  private getEmailVerifiedKey(
    email: string,
    purpose: 'REGISTER' | 'RESET_PASSWORD',
  ): string {
    return `email_verified:${purpose}:${email}`;
  }

  async sendEmailCode(
    dto: SendEmailCodeDto,
  ): Promise<{ message: string }> {
    const { email, purpose } = dto;

    // 회원가입
    if (purpose === 'REGISTER') {
      const exists = await this.userRepository.findOne({
        where: { email },
      });

      if (exists) {
        throw new BadRequestException(
          '이미 사용 중인 이메일입니다.',
        );
      }
    }

    // 비밀번호 재설정
    if (purpose === 'RESET_PASSWORD') {
      const exists = await this.userRepository.findOne({
        where: { email },
      });

      if (!exists) {
        throw new NotFoundException(
          '존재하지 않는 이메일입니다.',
        );
      }
    }

    const code = this.generateEmailCode();

    const key = this.getEmailCodeKey(
      email,
      purpose,
    );

    // 5분 저장
    await this.redis.set(
      key,
      code,
      'EX',
      60 * 5,
    );

    try {
      await this.mailService.sendVerificationCode(
        email,
        code,
        purpose,
      );
    } catch (error) {
      await this.redis.del(key);

      throw new InternalServerErrorException(
        '이메일 발송에 실패했습니다.',
      );
    }

    return {
      message: '인증코드가 이메일로 발송되었습니다.',
    };
  }

  async verifyEmailCode(
    dto: VerifyEmailCodeDto,
  ): Promise<{ message: string }> {
    const { email, code, purpose } = dto;

    const key = this.getEmailCodeKey(
      email,
      purpose,
    );

    const savedCode = await this.redis.get(key);

    if (!savedCode) {
      throw new BadRequestException(
        '인증코드가 만료되었거나 존재하지 않습니다.',
      );
    }

    if (savedCode !== code) {
      throw new BadRequestException(
        '인증코드가 일치하지 않습니다.',
      );
    }

    // 기존 인증코드 삭제
    await this.redis.del(key);

    // 인증 완료 플래그 저장
    await this.redis.set(
      this.getEmailVerifiedKey(
        email,
        purpose,
      ),
      'true',
      'EX',
      60 * 10,
    );

    return {
      message: '이메일 인증이 완료되었습니다.',
    };
  }

  async checkEmailVerified(
    email: string,
    purpose: 'REGISTER' | 'RESET_PASSWORD',
  ): Promise<void> {
    const verified = await this.redis.get(
      this.getEmailVerifiedKey(
        email,
        purpose,
      ),
    );

    if (verified !== 'true') {
      throw new BadRequestException(
        '이메일 인증이 필요합니다.',
      );
    }
  }

  async clearEmailVerified(
    email: string,
    purpose: 'REGISTER' | 'RESET_PASSWORD',
  ): Promise<void> {
    await this.redis.del(
      this.getEmailVerifiedKey(
        email,
        purpose,
      ),
    );
  }
}