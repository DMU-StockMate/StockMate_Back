import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from '../users/entities/user.entity';
import { MailModule } from './mail.module';

import { EmailVerificationService } from './service/email-verification.service';
import { EmailVerificationController } from './controller/email-verification.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    MailModule,
  ],
  controllers: [EmailVerificationController],
  providers: [EmailVerificationService],
  exports: [EmailVerificationService],
})
export class EmailVerificationModule {}