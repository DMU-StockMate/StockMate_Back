import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCommunityCommentDto {
  @ApiProperty({ example: '저도 비슷하게 보고 있습니다.' })
  @IsString()
  @MinLength(1)
  @MaxLength(3000)
  content: string;
}
