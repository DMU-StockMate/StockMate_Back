import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, Min } from 'class-validator';

export class GenerateQuestionRequestDto {
  @ApiProperty({
    example: 2,
    description: '학습 주제 ID',
  })
  @IsInt()
  @Min(1)
  topicId: number;

  @ApiProperty({
    example: 1,
    description: '투자 등급 ID',
  })
  @IsInt()
  @Min(1)
  investmentLevelId: number;

  @ApiProperty({
    example: 'MULTIPLE_CHOICE',
    enum: ['MULTIPLE_CHOICE', 'OX'],
    description: '생성할 문제 유형',
  })
  @IsIn(['MULTIPLE_CHOICE', 'OX'])
  questionType: 'MULTIPLE_CHOICE' | 'OX';
}