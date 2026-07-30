import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePostDto {
  @ApiPropertyOptional({ example: '수정된 제목', description: '게시글 제목' })
  @IsOptional()
  @IsString({ message: '제목은 문자열이어야 합니다.' })
  @MaxLength(255, { message: '제목은 255자 이하여야 합니다.' })
  title?: string;

  @ApiPropertyOptional({ example: '수정된 내용', description: '게시글 내용' })
  @IsOptional()
  @IsString({ message: '내용은 문자열이어야 합니다.' })
  content?: string;
}
