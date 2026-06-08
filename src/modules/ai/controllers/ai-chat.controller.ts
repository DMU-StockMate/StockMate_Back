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
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
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

  @Post('chat/stream')
  @ApiOperation({
    summary: '일반 AI 채팅 SSE',
    description:
      '문제 ID 없이 사용자의 일반 투자 질문을 AI 서버에 전달하고 SSE 방식으로 답변을 스트리밍합니다.',
  })
  @ApiBody({
    type: QuestionAiChatRequestDto,
    description: 'AI에게 전달할 사용자 질문 메시지',
  })
  @ApiResponse({
    status: 201,
    description: 'SSE 스트리밍 응답 시작',
    schema: {
      example:
        'data: {"type":"session","sessionId":1}\n\n' +
        'data: {"type":"token","content":"확인해보면"}\n\n' +
        'data: {"type":"done","sessionId":1}\n\n',
    },
  })
  @ApiBadRequestResponse({
    description:
      '질문 메시지가 비어 있거나, 형식이 올바르지 않은 경우',
  })
  @ApiUnauthorizedResponse({
    description: 'JWT 인증이 필요합니다.',
  })
  @ApiNotFoundResponse({
    description: '사용자를 찾을 수 없는 경우',
  })
  @ApiInternalServerErrorResponse({
    description: '서버 내부 오류',
  })
  startGeneralChatStream(
    @Req() req,
    @Body() dto: QuestionAiChatRequestDto,
    @Res() res: Response,
  ) {
    return this.aiChatService.startGeneralChatStream(
      req.user.userId,
      dto.message,
      res,
    );
  }

  @Post('questions/:questionId/chat/stream')
  @ApiOperation({
    summary: '문제 기반 AI 질문 시작 SSE',
    description:
      '문제 풀이 중 사용자가 AI에게 질문하면, questionId를 기준으로 문제 정보와 사용자 투자 등급을 조합해 AI 서버에 전달하고 SSE 방식으로 답변을 스트리밍합니다.',
  })
  @ApiParam({
    name: 'questionId',
    type: Number,
    example: 1,
    description: 'AI에게 질문할 문제 ID',
  })
  @ApiBody({
    type: QuestionAiChatRequestDto,
    description: 'AI에게 전달할 사용자 질문 메시지',
  })
  @ApiResponse({
    status: 201,
    description: 'SSE 스트리밍 응답 시작',
    schema: {
      example:
        'data: {"type":"session","sessionId":1}\n\n' +
        'data: {"type":"token","content":"PER은"}\n\n' +
        'data: {"type":"token","content":" 업종별로"}\n\n' +
        'data: {"type":"done","sessionId":1}\n\n',
    },
  })
  @ApiBadRequestResponse({
    description:
      '질문 메시지가 비어 있거나, 형식이 올바르지 않은 경우',
  })
  @ApiUnauthorizedResponse({
    description: 'JWT 인증이 필요합니다.',
  })
  @ApiNotFoundResponse({
    description: '사용자 또는 문제를 찾을 수 없는 경우',
  })
  @ApiInternalServerErrorResponse({
    description: 'AI 서버 요청 실패 또는 서버 내부 오류',
  })
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
  @ApiOperation({
    summary: 'AI 대화 세션 이어서 질문 SSE',
    description:
      '기존 AI 대화 세션에 사용자 메시지를 추가하고, DB에 저장된 이전 대화 내역을 history로 포함해 AI 서버에 전달한 뒤 SSE 방식으로 답변을 스트리밍합니다.',
  })
  @ApiParam({
    name: 'sessionId',
    type: Number,
    example: 1,
    description: 'AI 대화 세션 ID',
  })
  @ApiBody({
    type: QuestionAiChatRequestDto,
    description: 'AI에게 전달할 추가 질문 메시지',
  })
  @ApiResponse({
    status: 201,
    description: 'SSE 스트리밍 응답 시작',
    schema: {
      example:
        'data: {"type":"token","content":"이전 설명에 이어서"}\n\n' +
        'data: {"type":"token","content":" 추가로 설명하면"}\n\n' +
        'data: {"type":"done","sessionId":1}\n\n',
    },
  })
  @ApiBadRequestResponse({
    description:
      '질문 메시지가 비어 있거나, 형식이 올바르지 않은 경우',
  })
  @ApiUnauthorizedResponse({
    description: 'JWT 인증이 필요합니다.',
  })
  @ApiNotFoundResponse({
    description: 'AI 대화 세션을 찾을 수 없는 경우',
  })
  @ApiInternalServerErrorResponse({
    description: 'AI 서버 요청 실패 또는 서버 내부 오류',
  })
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
