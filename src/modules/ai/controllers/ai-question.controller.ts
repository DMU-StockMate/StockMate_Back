import {
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../users/guards/jwt-auth.guard';
import { AiQuestionService } from '../services/ai-question.service';
import { GenerateQuestionRequestDto } from '../dto/generate-question-request.dto';

@ApiTags('ai-question')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard)
@Controller('ai/questions')
export class AiQuestionController {
  constructor(
    private readonly aiQuestionService: AiQuestionService,
  ) {}

  @Post('generate')
  @ApiOperation({
    summary: 'AI 문제 생성',
    description:
      'AI 서버에 문제 생성을 요청하고, 생성된 문제를 quiz_questions와 quiz_choices에 저장합니다.',
  })
  @ApiBody({
    type: GenerateQuestionRequestDto,
    description:
        'topicId, investmentLevelId, questionType을 기반으로 AI 서버에 문제 생성을 요청합니다. AI 서버 응답은 question_type, question_text, explanation, reward_cash, choices 형식이어야 합니다.',
    })
  @ApiResponse({
    status: 201,
    description:
        'AI 서버는 아래 JSON 형식으로 문제를 생성해 반환해야 합니다. Nest는 이 응답을 검증한 뒤 DB에 저장합니다.',
    schema: {
        example: {
        question_type: 'MULTIPLE_CHOICE',
        question_text: 'PER의 의미로 가장 적절한 것은?',
        explanation: 'PER은 주가를 주당순이익으로 나눈 값입니다.',
        reward_cash: 1000,
        choices: [
            {
            choice_no: 1,
            text: '주가를 주당순이익으로 나눈 값',
            is_correct: true,
            },
            {
            choice_no: 2,
            text: '주가를 주당순자산으로 나눈 값',
            is_correct: false,
            },
        ],
        },
    },
  })
  generateQuestion(
    @Body() dto: GenerateQuestionRequestDto,
  ) {
    return this.aiQuestionService.generateQuestion(dto);
  }
}