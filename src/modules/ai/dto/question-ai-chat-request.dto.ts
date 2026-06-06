import {
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';

// 문제 기반 AI 채팅 요청 DTO
// questionId는 URL Path Parameter로 전달하고
// DTO에서는 사용자 질문 메시지만 전달
export class QuestionAiChatRequestDto {
  @ApiProperty({
    example:
      'PER이 낮다고 항상 저평가라고 볼 수 없는 이유가 뭔가요?',
    description: 'AI에게 보낼 사용자 질문 메시지',
    required: true,
    maxLength: 1000,
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