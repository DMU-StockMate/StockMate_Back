
import { IsEmail, IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
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
  password: string;

  // 이름
  @ApiProperty({ example: '홍길동', description: '이름' })
  @IsString({ message: '이름은 문자열이어야 합니다.' })
  @IsNotEmpty({ message: '이름은 필수입니다.' })
  @Length(1, 100, { message: '이름은 1자 이상 100자 이하로 입력해주세요.' })
  name: string;

  // 전화번호
  @ApiProperty({ example: '010-1234-5678', description: '전화번호' })
  @IsString({ message: '전화번호는 문자열이어야 합니다.' })
  @IsNotEmpty({ message: '전화번호는 필수입니다.' })
  @Matches(/^01[0-9]-?\d{3,4}-?\d{4}$/, {
    message: '전화번호 형식이 올바르지 않습니다.',
  })
  phone: string;
}