import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class GeneratePromptQuestionRequestDto {
  @ApiProperty({
    example: 'PER와 PBR 차이를 초보자가 이해했는지 확인하는 문제를 만들어줘',
    description: 'AI 문제 생성을 위한 사용자 프롬프트',
  })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  prompt: string;

  @ApiProperty({
    example: 'MULTIPLE_CHOICE',
    enum: ['MULTIPLE_CHOICE', 'OX'],
    description: '생성할 문제 유형',
    required: false,
  })
  @IsOptional()
  @IsIn(['MULTIPLE_CHOICE', 'OX'])
  questionType?: 'MULTIPLE_CHOICE' | 'OX';

  @ApiProperty({
    example: 2,
    description: '저장할 학습 주제 ID',
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  topicId?: number;

  @ApiProperty({
    example: 1,
    description: '저장할 투자 등급 ID',
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  investmentLevelId?: number;
}
