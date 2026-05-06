
import { IsEmail, IsEnum, IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from 'src/modules/enums/role-enum';

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
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,20}$/, {
  message: '비밀번호는 8~20자이며, 영문과 숫자를 포함해야 합니다.',
})
  password: string;

  //닉네임
  @ApiProperty({ example: '스톡메이트', description: '닉네임' })
  @IsString({ message: '닉네임은 문자열이어야 합니다.' })
  @IsNotEmpty({ message: '닉네임은 필수입니다.' })
  @Length(2, 20, { message: '닉네임은 2자 이상 20자 이하로 입력해주세요.' })
  @Matches(/^[a-zA-Z0-9가-힣]+$/, {
    message: '닉네임은 한글, 영문, 숫자만 가능합니다.',
  })
  nickname: string;

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

  //최종 배포 시 삭제할 것
  @ApiProperty({
    description: '사용자 권한',
    enum: UserRole,
    example: UserRole.USER,
  })
  @IsEnum(UserRole, {
    message: '유효하지 않은 권한입니다.',
  })
  role: UserRole;
}