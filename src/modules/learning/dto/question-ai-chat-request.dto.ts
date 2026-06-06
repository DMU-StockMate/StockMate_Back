import {
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';

// 문제 풀이 중 AI에게 질문을 요청할 때 사용하는 DTO
export class QuestionAiChatRequestDto {

  @ApiProperty({
    example:
      'PER이 낮다고 항상 저평가라고 볼 수 없는 이유가 뭔가요?',
    description: 'AI에게 보낼 사용자 질문 메시지',
  })
  @IsString({
    message: '질문 메시지는 문자열이어야 합니다.',
  })
  @IsNotEmpty({
    message: '질문 메시지는 비어 있을 수 없습니다.',
  })
  @MaxLength(1000, {
    message: '질문 메시지는 최대 1000자까지 입력 가능합니다.',
  })
  message: string;
}