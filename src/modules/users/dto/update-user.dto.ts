import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class UpdateUserDto extends PartialType(CreateUserDto) {
	@ApiPropertyOptional({ example: '010-9999-8888', description: '전화번호(선택)' })
	phone?: string;

	@ApiPropertyOptional({ example: '홍길순', description: '이름(선택)' })
	name?: string;

	@ApiPropertyOptional({ example: '스톡메이트', description: '닉네임' })
	@IsString({ message: '닉네임은 문자열이어야 합니다.' })
	@IsNotEmpty({ message: '닉네임은 필수입니다.' })
	@Length(2, 20, { message: '닉네임은 2자 이상 20자 이하로 입력해주세요.' })
	@Matches(/^[a-zA-Z0-9가-힣]+$/, {
		message: '닉네임은 한글, 영문, 숫자만 가능합니다.',
	})
	nickname: string;
}