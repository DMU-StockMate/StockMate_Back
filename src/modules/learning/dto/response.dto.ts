import { ApiProperty } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsInt, IsNotEmpty, IsString, Min, ValidateNested } from 'class-validator';

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
    example:
      'PER이 낮을수록 일반적으로 어떤 의미로 해석될 가능성이 높은가?',
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
}