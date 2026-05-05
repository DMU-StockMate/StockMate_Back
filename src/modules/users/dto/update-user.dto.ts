import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto extends PartialType(CreateUserDto) {
	@ApiPropertyOptional({ example: '010-9999-8888', description: '전화번호(선택)' })
	phone?: string;

	@ApiPropertyOptional({ example: '홍길순', description: '이름(선택)' })
	name?: string;

}