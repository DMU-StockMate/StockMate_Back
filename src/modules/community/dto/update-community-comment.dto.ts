import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateCommunityCommentDto {
  @ApiProperty({ example: '수정된 댓글입니다.' })
  @IsString()
  @MinLength(1)
  @MaxLength(3000)
  content: string;
}
