import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ example: '좋은 글 감사합니다.', description: '댓글 내용' })
  @IsNotEmpty({ message: '내용은 필수입니다.' })
  @IsString({ message: '내용은 문자열이어야 합니다.' })
  content: string;
}
