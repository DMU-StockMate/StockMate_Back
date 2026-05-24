import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../users/guards/jwt-auth.guard';
import { AiChatService } from '../services/ai-chat.service';
import { QuestionAiChatRequestDto } from '../dto/question-ai-chat-request.dto';

@ApiTags('ai-chat')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) {}

  @Post('questions/:questionId/chat/stream')
  @ApiOperation({ summary: '문제 기반 AI 질문 시작 SSE' })
  @ApiParam({
    name: 'questionId',
    type: Number,
    example: 1,
    description: 'AI에게 질문할 문제 ID',
  })
  @ApiBody({ type: QuestionAiChatRequestDto })
  startQuestionChatStream(
    @Req() req,
    @Param('questionId', ParseIntPipe) questionId: number,
    @Body() dto: QuestionAiChatRequestDto,
    @Res() res: Response,
  ) {
    return this.aiChatService.startQuestionChatStream(
      req.user.userId,
      questionId,
      dto.message,
      res,
    );
  }

  @Post('chat-sessions/:sessionId/messages/stream')
  @ApiOperation({ summary: 'AI 대화 세션 이어서 질문 SSE' })
  @ApiParam({
    name: 'sessionId',
    type: Number,
    example: 1,
    description: 'AI 대화 세션 ID',
  })
  @ApiBody({ type: QuestionAiChatRequestDto })
  sendMessageStream(
    @Req() req,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Body() dto: QuestionAiChatRequestDto,
    @Res() res: Response,
  ) {
    return this.aiChatService.sendMessageStream(
      req.user.userId,
      sessionId,
      dto.message,
      res,
    );
  }
}