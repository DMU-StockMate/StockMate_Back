import { Body, Controller, Post } from '@nestjs/common';

import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { EmailVerificationService } from '../services/email-verification.service';
import { SendEmailCodeDto } from '../dto/send-email-code.dto';
import { VerifyEmailCodeDto } from '../dto/verify-email-code.dto';

@ApiTags('email-verification')
@Controller('auth/email')
export class EmailVerificationController {
  constructor(
    private readonly emailVerificationService: EmailVerificationService,
  ) {}

  @Post('send-code')
  @ApiOperation({
    summary: '이메일 인증코드 발송',
    description:
      '회원가입 또는 비밀번호 재설정을 위한 이메일 인증코드를 발송합니다.',
  })
  @ApiBody({
    type: SendEmailCodeDto,
    description: '이메일 인증코드 발송 정보',
  })
  @ApiCreatedResponse({
    description: '인증코드가 이메일로 발송되었습니다.',
  })
  @ApiBadRequestResponse({
    description: `
- 올바른 이메일 형식이어야 합니다.
- 이메일은 필수입니다.
- purpose는 REGISTER 또는 RESET_PASSWORD만 가능합니다.
- 이미 사용 중인 이메일입니다.
    `,
  })
  @ApiNotFoundResponse({
    description: '존재하지 않는 이메일입니다.',
  })
  @ApiInternalServerErrorResponse({
    description: `
- 이메일 발송에 실패했습니다.
- Redis 저장 실패
- 서버 내부 오류
    `,
  })
  sendEmailCode(@Body() dto: SendEmailCodeDto) {
    return this.emailVerificationService.sendEmailCode(dto);
  }

  @Post('verify-code')
  @ApiOperation({
    summary: '이메일 인증코드 확인',
    description:
      '사용자가 입력한 이메일 인증코드를 확인하고 인증 완료 상태를 Redis에 저장합니다.',
  })
  @ApiBody({
    type: VerifyEmailCodeDto,
    description: '이메일 인증코드 확인 정보',
  })
  @ApiCreatedResponse({
    description: '이메일 인증이 완료되었습니다.',
  })
  @ApiBadRequestResponse({
    description: `
- 올바른 이메일 형식이어야 합니다.
- 이메일은 필수입니다.
- 인증코드는 문자열이어야 합니다.
- 인증코드는 6자리여야 합니다.
- purpose는 REGISTER 또는 RESET_PASSWORD만 가능합니다.
- 인증코드가 만료되었거나 존재하지 않습니다.
- 인증코드가 일치하지 않습니다.
    `,
  })
  @ApiInternalServerErrorResponse({
    description: `
- Redis 조회 실패
- Redis 저장 실패
- 서버 내부 오류
    `,
  })
  verifyEmailCode(@Body() dto: VerifyEmailCodeDto) {
    return this.emailVerificationService.verifyEmailCode(dto);
  }
}
