import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { JwtAuthGuard } from 'src/modules/users/guards/jwt-auth.guard';
import { LearningService } from '../service/learning.service';
import { SubmitAnswerDto } from '../dto/submit-answer.dto';
import { QuestionResponseDto } from '../dto/reponse.dto';

@ApiTags('learning')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard)
@Controller('learning')
export class LearningController {
  constructor(private readonly learningService: LearningService) {}

  @Get('questions')
  @ApiOperation({
    summary: '문제 목록 조회',
    description: '활성화된 투자 학습 문제 목록을 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '문제 목록 조회 성공',
  })
  @ApiUnauthorizedResponse({
    description: `
- accessToken 없음
- accessToken 만료
- 잘못된 토큰
    `,
  })
  @ApiInternalServerErrorResponse({
    description: `
- DB 조회 실패
- 서버 내부 오류
    `,
  })
  findAllQuestions() {
    return this.learningService.findAllQuestions();
  }

  @Get('questions/:questionId')
  @ApiOperation({
    summary: '문제 상세 조회',
    description: '특정 문제의 상세 정보와 선택지를 조회합니다.',
  })
  @ApiParam({
    name: 'questionId',
    type: Number,
    description: '조회할 문제 ID',
  })
  @ApiResponse({
    status: 200,
    description: '문제 상세 조회 성공',
  })
  @ApiBadRequestResponse({
    description: `
- questionId가 숫자가 아닙니다.
    `,
  })
  @ApiUnauthorizedResponse({
    description: `
- accessToken 없음
- accessToken 만료
- 잘못된 토큰
    `,
  })
  @ApiNotFoundResponse({
    description: '문제를 찾을 수 없습니다.',
  })
  @ApiInternalServerErrorResponse({
    description: `
- DB 조회 실패
- 서버 내부 오류
    `,
  })
  findOneQuestion(
    @Param('questionId', ParseIntPipe) questionId: number,
  ): Promise<QuestionResponseDto> {
    return this.learningService.findQuestionById(questionId);
  }

  @Post('questions/:questionId/submit')
  @ApiOperation({
    summary: '문제 정답 제출',
    description: '사용자가 선택한 답안을 제출하고 정답 여부, 보상, 해설을 반환합니다.',
  })
  @ApiParam({
    name: 'questionId',
    type: Number,
    description: '정답을 제출할 문제 ID',
  })
  @ApiBody({
    type: SubmitAnswerDto,
    description: '사용자가 선택한 보기 정보',
  })
  @ApiCreatedResponse({
    description: '정답 제출 성공',
  })
  @ApiBadRequestResponse({
    description: `
- questionId가 숫자가 아닙니다.
- selectedChoiceId가 누락되었습니다.
- selectedChoiceId는 정수여야 합니다.
- selectedChoiceId는 1 이상이어야 합니다.
- 해당 문제에 속하지 않는 선택지입니다.
    `,
  })
  @ApiUnauthorizedResponse({
    description: `
- accessToken 없음
- accessToken 만료
- 잘못된 토큰
    `,
  })
  @ApiNotFoundResponse({
    description: '문제를 찾을 수 없습니다.',
  })
  @ApiInternalServerErrorResponse({
    description: `
- 풀이 기록 저장 실패
- DB 오류
- 서버 내부 오류
    `,
  })
  submitAnswer(
    @Req() req,
    @Param('questionId', ParseIntPipe) questionId: number,
    @Body() dto: SubmitAnswerDto,
  ) {
    return this.learningService.submitAnswer(
      req.user.userId,
      questionId,
      dto,
    );
  }

  @Get('histories')
  @ApiOperation({
    summary: '학습 기록 조회',
    description: '로그인한 사용자의 전체 문제 풀이 기록을 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '학습 기록 조회 성공',
  })
  @ApiUnauthorizedResponse({
    description: `
- accessToken 없음
- accessToken 만료
- 잘못된 토큰
    `,
  })
  @ApiInternalServerErrorResponse({
    description: `
- DB 조회 실패
- 서버 내부 오류
    `,
  })
  getHistories(@Req() req) {
    return this.learningService.getHistories(req.user.userId);
  }

  @Get('statistics')
  @ApiOperation({
    summary: '학습 통계 조회',
    description: '총 풀이 수, 정답 수, 오답 수, 정답률을 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '학습 통계 조회 성공',
  })
  @ApiUnauthorizedResponse({
    description: `
- accessToken 없음
- accessToken 만료
- 잘못된 토큰
    `,
  })
  @ApiInternalServerErrorResponse({
    description: `
- DB 조회 실패
- 서버 내부 오류
    `,
  })
  getStatistics(@Req() req) {
    return this.learningService.getStatistics(req.user.userId);
  }

  @Get('wrong-notes')
  @ApiOperation({
    summary: '오답노트 목록 조회',
    description: '로그인한 사용자가 틀린 문제 목록을 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '오답노트 조회 성공',
  })
  @ApiUnauthorizedResponse({
    description: `
- accessToken 없음
- accessToken 만료
- 잘못된 토큰
    `,
  })
  @ApiInternalServerErrorResponse({
    description: `
- DB 조회 실패
- 서버 내부 오류
    `,
  })
  getWrongNotes(@Req() req) {
    return this.learningService.getWrongNotes(req.user.userId);
  }

  @Get('wrong-notes/:questionId')
  @ApiOperation({
    summary: '특정 오답 조회',
    description: '특정 문제에 대한 사용자의 오답 기록을 조회합니다.',
  })
  @ApiParam({
    name: 'questionId',
    type: Number,
    description: '조회할 문제 ID',
  })
  @ApiResponse({
    status: 200,
    description: '특정 오답 조회 성공',
  })
  @ApiBadRequestResponse({
    description: `
- questionId가 숫자가 아닙니다.
    `,
  })
  @ApiUnauthorizedResponse({
    description: `
- accessToken 없음
- accessToken 만료
- 잘못된 토큰
    `,
  })
  @ApiNotFoundResponse({
    description: '해당 오답 기록을 찾을 수 없습니다.',
  })
  @ApiInternalServerErrorResponse({
    description: `
- DB 조회 실패
- 서버 내부 오류
    `,
  })
  getWrongNote(
    @Req() req,
    @Param('questionId', ParseIntPipe) questionId: number,
  ) {
    return this.learningService.getWrongNote(
      req.user.userId,
      questionId,
    );
  }

  @Delete('wrong-notes/:questionId')
  @ApiOperation({
    summary: '오답노트 삭제',
    description: '특정 문제의 오답 기록을 삭제합니다.',
  })
  @ApiParam({
    name: 'questionId',
    type: Number,
    description: '삭제할 문제 ID',
  })
  @ApiResponse({
    status: 200,
    description: '오답 기록 삭제 성공',
  })
  @ApiBadRequestResponse({
    description: `
- questionId가 숫자가 아닙니다.
    `,
  })
  @ApiUnauthorizedResponse({
    description: `
- accessToken 없음
- accessToken 만료
- 잘못된 토큰
    `,
  })
  @ApiNotFoundResponse({
    description: '삭제할 오답 기록을 찾을 수 없습니다.',
  })
  @ApiInternalServerErrorResponse({
    description: `
- DB 삭제 실패
- 서버 내부 오류
    `,
  })
  deleteWrongNote(
    @Req() req,
    @Param('questionId', ParseIntPipe) questionId: number,
  ) {
    return this.learningService.deleteWrongNote(
      req.user.userId,
      questionId,
    );
  }

  @Post('bookmarks/:questionId')
  @ApiOperation({
    summary: '문제 북마크 추가',
    description: '특정 문제를 사용자의 북마크에 추가합니다.',
  })
  @ApiParam({
    name: 'questionId',
    type: Number,
    description: '북마크할 문제 ID',
  })
  @ApiCreatedResponse({
    description: '북마크 추가 성공',
  })
  @ApiBadRequestResponse({
    description: `
- questionId가 숫자가 아닙니다.
    `,
  })
  @ApiUnauthorizedResponse({
    description: `
- accessToken 없음
- accessToken 만료
- 잘못된 토큰
    `,
  })
  @ApiNotFoundResponse({
    description: '문제를 찾을 수 없습니다.',
  })
  @ApiConflictResponse({
    description: '이미 북마크한 문제입니다.',
  })
  @ApiInternalServerErrorResponse({
    description: `
- DB 저장 실패
- 서버 내부 오류
    `,
  })
  addBookmark(
    @Req() req,
    @Param('questionId', ParseIntPipe) questionId: number,
  ) {
    return this.learningService.addBookmark(
      req.user.userId,
      questionId,
    );
  }

  @Get('bookmarks')
  @ApiOperation({
    summary: '북마크 목록 조회',
    description: '사용자가 북마크한 문제 목록을 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '북마크 목록 조회 성공',
  })
  @ApiUnauthorizedResponse({
    description: `
- accessToken 없음
- accessToken 만료
- 잘못된 토큰
    `,
  })
  @ApiInternalServerErrorResponse({
    description: `
- DB 조회 실패
- 서버 내부 오류
    `,
  })
  getBookmarks(@Req() req) {
    return this.learningService.getBookmarks(req.user.userId);
  }

  @Delete('bookmarks/:questionId')
  @ApiOperation({
    summary: '북마크 삭제',
    description: '사용자가 북마크한 문제를 삭제합니다.',
  })
  @ApiParam({
    name: 'questionId',
    type: Number,
    description: '북마크 삭제할 문제 ID',
  })
  @ApiResponse({
    status: 200,
    description: '북마크 삭제 성공',
  })
  @ApiBadRequestResponse({
    description: `
- questionId가 숫자가 아닙니다.
    `,
  })
  @ApiUnauthorizedResponse({
    description: `
- accessToken 없음
- accessToken 만료
- 잘못된 토큰
    `,
  })
  @ApiNotFoundResponse({
    description: '삭제할 북마크를 찾을 수 없습니다.',
  })
  @ApiInternalServerErrorResponse({
    description: `
- DB 삭제 실패
- 서버 내부 오류
    `,
  })
  deleteBookmark(
    @Req() req,
    @Param('questionId', ParseIntPipe) questionId: number,
  ) {
    return this.learningService.deleteBookmark(
      req.user.userId,
      questionId,
    );
  }
  // @Post('questions/:questionId/chat/stream')
  // @UseGuards(JwtAuthGuard)
  // @ApiBearerAuth('accessToken')
  // @ApiOperation({ summary: '문제 풀이 중 AI 질문 시작 SSE' })
  // @ApiParam({
  //   name: 'questionId',
  //   type: Number,
  //   example: 1,
  //   description: 'AI에게 질문할 문제 ID',
  // })
  // @ApiBody({ type: QuestionAiChatRequestDto })
  // @ApiResponse({
  //   status: 201,
  //   description: 'AI 답변을 SSE 방식으로 스트리밍합니다.',
  // })
  // chatAboutQuestionStream(
  //   @Req() req,
  //   @Param('questionId', ParseIntPipe) questionId: number,
  //   @Body() dto: QuestionAiChatRequestDto,
  // ) {
  //   return this.learningService.chatAboutQuestionStream(
  //     req.user.userId,
  //     questionId,
  //     dto.message,
  //   );
  // }
  // @Post(':sessionId/messages/stream')
  // @UseGuards(JwtAuthGuard)
  // @ApiBearerAuth('accessToken')
  // @ApiOperation({ summary: 'AI 대화 세션 메시지 추가 SSE' })
  // @ApiParam({
  //   name: 'sessionId',
  //   type: Number,
  //   example: 1,
  //   description: 'AI 대화 세션 ID',
  // })
  // @ApiBody({ type: QuestionAiChatRequestDto })
  // sendMessageStream(
  //   @Req() req,
  //   @Param('sessionId', ParseIntPipe) sessionId: number,
  //   @Body() dto: QuestionAiChatRequestDto,
  // ) {
  //   return this.aiChatService.sendMessageStream(
  //     req.user.userId,
  //     sessionId,
  //     dto.message,
  //   );
  // }
}