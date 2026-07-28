import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class GenerateQuestionRequestDto {
  @ApiProperty({
    example: [1, 2, 3, 4, 5],
    description:
      '이번에 푼 문제 ID 목록. 이 목록 안에서 사용자가 틀린 문제만 AI 생성 맥락으로 사용합니다.',
    type: [Number],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  questionIds: number[];

  @ApiProperty({
    example: 2,
    description:
      '학습 주제 ID. 없으면 오답 문제의 주제를 기반으로 사용합니다.',
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  topicId?: number;

  @ApiProperty({
    example: 1,
    description:
      '투자 등급 ID. 없으면 오답 문제의 등급을 기반으로 사용합니다.',
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  investmentLevelId?: number;

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
    example: 1,
    description: '생성할 문제 개수',
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  count?: number;
}
