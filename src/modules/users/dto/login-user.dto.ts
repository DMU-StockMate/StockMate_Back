import { IsEmail, IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginUserDto {
  // 이메일
  @ApiProperty({ example: 'user@example.com', description: '이메일' })
  @IsEmail({}, { message: '올바른 이메일 형식이어야 합니다.' })
  @IsNotEmpty({ message: '이메일은 필수입니다.' })
  email: string;

  // 비밀번호
  @ApiProperty({ example: 'password1234', description: '비밀번호' })
  @IsString({ message: '비밀번호는 문자열이어야 합니다.' })
  @IsNotEmpty({ message: '비밀번호는 필수입니다.' })
  @Length(4, 20, { message: '비밀번호는 4자 이상 20자 이하로 입력해주세요.' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,20}$/, {
  message: '비밀번호는 8~20자이며, 영문과 숫자를 포함해야 합니다.',})
  password: string;
}
