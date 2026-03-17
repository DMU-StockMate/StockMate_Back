import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FindEmailDto {
  @ApiProperty({ example: '010-1234-5678', description: '전화번호' })
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: '홍길동', description: '이름' })
  @IsNotEmpty()
  name: string;
}
