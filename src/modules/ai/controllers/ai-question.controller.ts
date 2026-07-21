import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../users/guards/jwt-auth.guard';
import { GeneratePromptQuestionRequestDto } from '../dto/generate-prompt-question-request.dto';
import { GenerateQuestionRequestDto } from '../dto/generate-question-request.dto';
import { AiQuestionService } from '../services/ai-question.service';

//git 변경을 위해서 추가
@ApiTags('ai-question')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard)
@Controller('ai/questions')
export class AiQuestionController {
  constructor(private readonly aiQuestionService: AiQuestionService) {}

  @Post('generate')
  @ApiOperation({
    summary: 'AI 오답 기반 문제 생성',
    description:
      '로그인 사용자의 틀린 문제 기록을 기반으로 AI 문제 생성을 요청하고, 생성된 문제를 quiz_questions와 quiz_choices에 저장합니다.',
  })
  @ApiBody({
    type: GenerateQuestionRequestDto,
    description:
      '최근 오답 문제와 선택 옵션을 기반으로 AI 서버에 문제 생성을 요청합니다.',
  })
  @ApiResponse({
    status: 201,
    description: '오답 기반 AI 문제 생성 성공',
  })
  generateQuestion(@Req() req, @Body() dto: GenerateQuestionRequestDto) {
    return this.aiQuestionService.generateQuestion(req.user.userId, dto);
  }

  @Post('generate/prompt')
  @ApiOperation({
    summary: 'AI 프롬프트 기반 문제 생성',
    description:
      '개인별 학습 페이지에서 입력한 프롬프트를 기반으로 AI 문제 생성을 요청하고, 생성된 문제를 quiz_questions와 quiz_choices에 저장합니다.',
  })
  @ApiBody({
    type: GeneratePromptQuestionRequestDto,
    description:
      'prompt, questionType, topicId, investmentLevelId를 기반으로 AI 서버에 문제 생성을 요청합니다.',
  })
  @ApiResponse({
    status: 201,
    description: '프롬프트 기반 AI 문제 생성 성공',
  })
  generatePromptQuestion(
    @Req() req,
    @Body() dto: GeneratePromptQuestionRequestDto,
  ) {
    return this.aiQuestionService.generatePromptQuestion(req.user.userId, dto);
  }
}
