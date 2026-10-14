import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Response } from 'express';
import { Repository } from 'typeorm';

import { AiChatSession } from '../entities/ai-chat-session.entity';
import { AiChatMessage } from '../entities/ai-chat-message.entity';
import { User } from '../../users/entities/user.entity';
import { QuizQuestion } from '../../learning/entities/quiz-question.entity';
import { AiLlamaProviderService } from './ai-provider.service';

@Injectable()
export class AiChatService {
  constructor(
    @InjectRepository(AiChatSession)
    private readonly sessionRepository: Repository<AiChatSession>,

    @InjectRepository(AiChatMessage)
    private readonly messageRepository: Repository<AiChatMessage>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(QuizQuestion)
    private readonly questionRepository: Repository<QuizQuestion>,

    private readonly aiProvider: AiLlamaProviderService,
  ) {}

  async getChatSessions(userId: number, scope?: 'general' | 'question') {
    const query = this.sessionRepository
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.question', 'question')
      .leftJoinAndSelect('session.messages', 'message')
      .where('session.user_id = :userId', { userId })
      .orderBy('session.created_at', 'DESC')
      .addOrderBy('message.created_at', 'ASC');

    if (scope === 'general') {
      query.andWhere('question.question_id IS NULL');
    }

    if (scope === 'question') {
      query.andWhere('question.question_id IS NOT NULL');
    }

    const sessions = await query.getMany();

    return sessions.map((session) => {
      const lastMessage =
        session.messages.length > 0
          ? session.messages[session.messages.length - 1]
          : null;

      return {
        sessionId: session.session_id,
        questionId: session.question?.question_id ?? null,
        questionText: session.question?.question_text ?? null,
        sessionType: session.session_type,
        title: session.title ?? 'AI 대화',
        preview: lastMessage?.message_text ?? '대화 기록이 없습니다.',
        createdAt: session.created_at,
        updatedAt: lastMessage?.created_at ?? session.created_at,
        messages: this.toMessageDtos(session.messages),
      };
    });
  }

  async deleteChatSession(userId: number, sessionId: number) {
    return this.sessionRepository.manager.transaction(async (manager) => {
      const session = await manager.findOne(AiChatSession, {
        where: { session_id: sessionId, user: { user_id: userId } },
        lock: { mode: 'pessimistic_write' },
      });
      if (!session) {
        throw new NotFoundException('AI chat session not found.');
      }
      await manager.delete(AiChatMessage, { session: { session_id: sessionId } });
      await manager.delete(AiChatSession, { session_id: sessionId });
      return { sessionId, deleted: true };
    });
  }

  async getChatSessionMessages(userId: number, sessionId: number) {
    const session = await this.sessionRepository.findOne({
      where: {
        session_id: sessionId,
        user: { user_id: userId },
      },
      relations: ['messages'],
      order: {
        messages: {
          created_at: 'ASC',
        },
      },
    });

    if (!session) {
      throw new NotFoundException('AI 대화 세션을 찾을 수 없습니다.');
    }

    return this.toMessageDtos(session.messages);
  }

  async startQuestionChatStream(
    userId: number,
    questionId: number,
    message: string,
    res: Response,
  ) {
    const user = await this.userRepository.findOne({
      where: { user_id: userId },
      relations: ['investmentLevel'],
    });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const question = await this.questionRepository.findOne({
      where: {
        question_id: questionId,
        status: 'ACTIVE',
      },
      relations: ['choices', 'topicName', 'investmentLevel'],
    });

    if (!question) {
      throw new NotFoundException('문제를 찾을 수 없습니다.');
    }

    const session = await this.sessionRepository.save(
      this.sessionRepository.create({
        user,
        question,
        session_type: 'FEEDBACK',
        title: `문제 ${questionId} AI 질문`,
      }),
    );

    await this.messageRepository.save({
      session,
      sender_type: 'USER',
      message_text: message,
    });

    this.setSseHeaders(res);

    this.sendSse(res, {
      type: 'session',
      sessionId: session.session_id,
    });

    const context = this.buildQuestionContext(
        user,
        question,
        message,
    );

    let aiText = '';

    try {
      aiText = await this.aiProvider.streamChat({
        context,
        onToken: (token) => {
          this.sendSse(res, {
            type: 'token',
            content: token,
          });
        },
      });
    } catch (error) {
      this.sendSse(res, {
        type: 'error',
        message: this.getAiErrorMessage(error),
      });
      res.end();
      return;
    }

    await this.messageRepository.save({
      session,
      sender_type: 'AI',
      message_text: aiText,
    });

    this.sendSse(res, {
      type: 'done',
      sessionId: session.session_id,
    });

    res.end();
  }

  async startGeneralChatStream(
    userId: number,
    message: string,
    res: Response,
  ) {
    const user = await this.userRepository.findOne({
      where: { user_id: userId },
      relations: ['investmentLevel'],
    });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const session = await this.sessionRepository.save(
      this.sessionRepository.create({
        user,
        question: null,
        session_type: 'GENERAL',
        title: message.slice(0, 40),
      }),
    );

    await this.messageRepository.save({
      session,
      sender_type: 'USER',
      message_text: message,
    });

    this.setSseHeaders(res);

    this.sendSse(res, {
      type: 'session',
      sessionId: session.session_id,
    });

    const context = {
      question: message,
      history: [],
      user: {
        user_id: user.user_id,
        investment_level:
          user.investmentLevel?.levelName ?? '미설정',
      },
      quiz_context: null,
    };

    let aiText = '';

    try {
      aiText = await this.aiProvider.streamChat({
        context,
        onToken: (token) => {
          this.sendSse(res, {
            type: 'token',
            content: token,
          });
        },
      });
    } catch (error) {
      this.sendSse(res, {
        type: 'error',
        message: this.getAiErrorMessage(error),
      });
      res.end();
      return;
    }

    await this.messageRepository.save({
      session,
      sender_type: 'AI',
      message_text: aiText,
    });

    this.sendSse(res, {
      type: 'done',
      sessionId: session.session_id,
    });

    res.end();
  }

  async sendMessageStream(
    userId: number,
    sessionId: number,
    message: string,
    res: Response,
  ) {
    const session = await this.sessionRepository.findOne({
      where: {
        session_id: sessionId,
        user: { user_id: userId },
      },
      relations: [
        'user',
        'user.investmentLevel',
        'question',
        'question.choices',
        'question.topicName',
        'question.investmentLevel',
        'messages',
      ],
      order: {
        messages: {
          created_at: 'ASC',
        },
      },
    });

    if (!session) {
      throw new NotFoundException('AI 대화 세션을 찾을 수 없습니다.');
    }

    await this.messageRepository.save({
      session,
      sender_type: 'USER',
      message_text: message,
    });

    this.setSseHeaders(res);

    const recentMessages = session.messages.slice(-10);

    console.log(
      'AI 이어가기 history:',
      JSON.stringify(
        recentMessages.map((msg) => ({
          role:
            msg.sender_type === 'USER'
              ? 'user'
              : 'assistant',
          content: msg.message_text,
          createdAt: msg.created_at,
        })),
        null,
        2,
      ),
    );

    const context = this.buildFollowUpContext(
    session,
    recentMessages,
    message,
    );

    let aiText = '';

    try {
      aiText = await this.aiProvider.streamChat({
        context,
        onToken: (token) => {
          this.sendSse(res, {
            type: 'token',
            content: token,
          });
        },
      });
    } catch (error) {
      this.sendSse(res, {
        type: 'error',
        message: this.getAiErrorMessage(error),
      });
      res.end();
      return;
    }

    await this.messageRepository.save({
      session,
      sender_type: 'AI',
      message_text: aiText,
    });

    this.sendSse(res, {
      type: 'done',
      sessionId,
    });

    res.end();
  }

    private buildQuestionContext(
      user: User,
      question: QuizQuestion,
      message: string,
    ) {
      return {
        question: message,

        history: [],

        user: {
          user_id: user.user_id,
          investment_level:
            user.investmentLevel?.levelName ?? '미설정',
        },

        quiz_context: {
          question_id: question.question_id,
          question_type: question.question_type,
          question_text: question.question_text,
          explanation: question.explanation,
          topic: question.topicName?.topicName ?? '미분류',
          level:
            question.investmentLevel?.levelName ?? '미설정',

          choices: question.choices.map((choice) => ({
            choice_no: choice.choice_no,
            text: choice.choice_text,
            is_correct: choice.is_correct,
          })),
        },
      };
    }
    private buildFollowUpContext(
      session: AiChatSession,
      recentMessages: AiChatMessage[],
      message: string,
    ) {
      return {
        question: message,

        history: recentMessages.map((msg) => ({
          role:
            msg.sender_type === 'USER'
              ? 'user'
              : 'assistant',
          content: msg.message_text,
        })),

        user: {
          user_id: session.user.user_id,
          investment_level:
            session.user.investmentLevel?.levelName ?? '미설정',
        },

        quiz_context: session.question
          ? {
              question_id: session.question.question_id,
              question_type: session.question.question_type,
              question_text: session.question.question_text,
              explanation: session.question.explanation,
              topic:
                session.question.topicName?.topicName ?? '미분류',
              level:
                session.question.investmentLevel?.levelName ??
                '미설정',

              choices:
                session.question.choices?.map((choice) => ({
                  choice_no: choice.choice_no,
                  text: choice.choice_text,
                  is_correct: choice.is_correct,
                })) ?? [],
            }
          : null,
      };
    }

  private setSseHeaders(res: Response) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
  }

  private sendSse(res: Response, data: unknown) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  private getAiErrorMessage(error: unknown) {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return 'AI 서버 요청에 실패했습니다.';
  }

  private toMessageDtos(messages: AiChatMessage[]) {
    return messages.map((message) => ({
      messageId: message.message_id,
      senderType: message.sender_type,
      messageText: message.message_text,
      createdAt: message.created_at,
    }));
  }
}
