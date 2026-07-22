import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCommunityPostDto {
  @ApiProperty({ example: '오늘 시장 어떻게 보시나요?' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title: string;

  @ApiProperty({ example: '반도체 업종 흐름이 궁금합니다.' })
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  content: string;
}
