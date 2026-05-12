import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly mailerService: MailerService,
  ) {}

  async sendVerificationCode(
    email: string,
    code: string,
    purpose: 'REGISTER' | 'RESET_PASSWORD',
  ): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: email,
        subject:
          purpose === 'REGISTER'
            ? '[StockMate] 회원가입 인증코드'
            : '[StockMate] 비밀번호 재설정 인증코드',
        html: `
          <h2>StockMate 이메일 인증</h2>
          <p>아래 인증코드를 입력해주세요.</p>
          <h1>${code}</h1>
          <p>인증코드는 5분 동안 유효합니다.</p>
        `,
      });
    } catch (error) {
      this.logger.error('이메일 발송 실패', error);

      throw new InternalServerErrorException(
        '이메일 발송에 실패했습니다.',
      );
    }
  }
}