import { ApiProperty } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

//배열 내부 객체 검증에 취약해 분리했음
// Swagger 문서화 및 선택지 객체 검증을 위해 별도 클래스로 분리
class QuestionChoiceResponseDto {
  @ApiProperty({
    example: 1,
    description: '선택지 ID',
  })
  @IsInt({
    message: '선택지 ID는 숫자여야 합니다.',
  })
  @Min(1, {
    message: '선택지 ID는 1 이상이어야 합니다.',
  })
  id: number;

  @ApiProperty({
    example: 'PER은 기업의 주가수익비율이다.',
    description: '선택지 내용',
  })
  @IsString({
    message: '선택지 내용은 문자열이어야 합니다.',
  })
  @IsNotEmpty({
    message: '선택지 내용은 비어 있을 수 없습니다.',
  })
  text: string;
}

// 사용자에게 전달할 문제 정보와 선택지 목록을 포함
export class QuestionResponseDto {
  @ApiProperty({
    example: 1,
    description: '문제 ID',
  })
  @IsInt({
    message: '문제 ID는 숫자여야 합니다.',
  })
  @Min(1, {
    message: '문제 ID는 1 이상이어야 합니다.',
  })
  questionId: number;

  @ApiProperty({
    example: 'PER이 낮을수록 일반적으로 어떤 의미로 해석될 가능성이 높은가?',
    description: '문제 내용',
  })
  @IsString({
    message: '문제 내용은 문자열이어야 합니다.',
  })
  @IsNotEmpty({
    message: '문제 내용은 비어 있을 수 없습니다.',
  })
  questionText: string;

  @ApiProperty({
    description: '문제 선택지 목록',
    type: [QuestionChoiceResponseDto],
  })
  @IsArray({
    message: '선택지 목록은 배열이어야 합니다.',
  })
  @ArrayNotEmpty({
    message: '선택지는 최소 1개 이상이어야 합니다.',
  })
  @ValidateNested({ each: true })
  @Type(() => QuestionChoiceResponseDto)
  choices: QuestionChoiceResponseDto[];

  @ApiProperty({
    example: true,
    description: '현재 사용자가 이 문제를 풀이했는지 여부',
  })
  alreadySolved: boolean;

  @ApiProperty({
    example: true,
    nullable: true,
    description: '마지막 제출 정답 여부',
  })
  lastCorrect: boolean | null;

  @ApiProperty({
    example: 3,
    nullable: true,
    description: '마지막으로 선택한 보기 ID',
  })
  selectedChoiceId: number | null;

  @ApiProperty({
    example: '2026-09-16T12:00:00.000Z',
    nullable: true,
    description: '마지막 제출 시각',
  })
  lastSolvedAt: Date | null;

  @ApiProperty({
    example: 5000,
    description: '이 문제로 이미 지급받은 보상',
  })
  rewardCashEarned: number;
}
