import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreatePostDto {
  @ApiProperty({ example: '오늘 시장 어떻게 보세요?', description: '게시글 제목' })
  @IsNotEmpty({ message: '제목은 필수입니다.' })
  @IsString({ message: '제목은 문자열이어야 합니다.' })
  @MaxLength(255, { message: '제목은 255자 이하여야 합니다.' })
  title: string;

  @ApiProperty({ example: '오늘 장 흐름 어떻게 보시나요?', description: '게시글 내용' })
  @IsNotEmpty({ message: '내용은 필수입니다.' })
  @IsString({ message: '내용은 문자열이어야 합니다.' })
  content: string;
}
