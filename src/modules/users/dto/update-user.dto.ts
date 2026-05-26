import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({
    example: '010-9999-8888',
    description: '전화번호(선택)',
  })
  @IsOptional()
  @IsString({ message: '전화번호는 문자열이어야 합니다.' })
  @Matches(/^01[0-9]-?\d{3,4}-?\d{4}$/, {
    message: '전화번호 형식이 올바르지 않습니다.',
  })
  phone?: string;

  @ApiPropertyOptional({ example: '홍길순', description: '이름(선택)' })
  @IsOptional()
  @IsString({ message: '이름은 문자열이어야 합니다.' })
  @Length(1, 100, { message: '이름은 1자 이상 100자 이하로 입력해주세요.' })
  name?: string;

  @ApiPropertyOptional({ example: '스톡메이트', description: '닉네임(선택)' })
  @IsOptional()
  @IsString({ message: '닉네임은 문자열이어야 합니다.' })
  @Length(2, 20, { message: '닉네임은 2자 이상 20자 이하로 입력해주세요.' })
  @Matches(/^[a-zA-Z0-9가-힣]+$/, {
    message: '닉네임은 한글, 영문, 숫자만 가능합니다.',
  })
  nickname?: string;
}
