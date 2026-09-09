import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginUserDto {
  // 이메일
  @ApiProperty({ example: 'user@example.com', description: '이메일' })
  @IsEmail({}, { message: '올바른 이메일 형식이어야 합니다.' })
  @IsNotEmpty({ message: '이메일은 필수입니다.' })
  email: string;

  // 비밀번호 (기존 비밀번호 확인용이므로 형식 검증은 하지 않음 - bcrypt 비교로 판단)
  @ApiProperty({ example: 'password1234', description: '비밀번호' })
  @IsString({ message: '비밀번호는 문자열이어야 합니다.' })
  @IsNotEmpty({ message: '비밀번호는 필수입니다.' })
  password: string;
}
