import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyEmailCodeDto {
  @ApiProperty({
    example: 'user@example.com',
    description: '인증할 이메일',
  })
  @IsEmail({}, { message: '올바른 이메일 형식이어야 합니다.' })
  @IsNotEmpty({ message: '이메일은 필수입니다.' })
  email: string;

  @ApiProperty({
    example: '123456',
    description: '이메일로 받은 6자리 인증코드',
  })
  @IsString({ message: '인증코드는 문자열이어야 합니다.' })
  @Length(6, 6, { message: '인증코드는 6자리여야 합니다.' })
  code: string;

  @ApiProperty({
    example: 'REGISTER',
    description: '인증 목적: REGISTER 또는 RESET_PASSWORD',
    enum: ['REGISTER', 'RESET_PASSWORD'],
  })
  @IsIn(['REGISTER', 'RESET_PASSWORD'], {
    message: 'purpose는 REGISTER 또는 RESET_PASSWORD만 가능합니다.',
  })
  purpose: 'REGISTER' | 'RESET_PASSWORD';
}