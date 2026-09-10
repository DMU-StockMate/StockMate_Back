import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class WithdrawDto {
  @ApiPropertyOptional({ example: 'password1234', description: '현재 비밀번호' })
  @IsString({ message: '비밀번호는 문자열이어야 합니다.' })
  @IsOptional()
  password?: string;

  @ApiPropertyOptional({ description: '구글 계정 재인증 ID 토큰' })
  @IsString()
  @IsOptional()
  googleIdToken?: string;
}
