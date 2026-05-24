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
import { AiLlamaProviderService } from './ai-provide.service';

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
        session_type: 'GENERAL',
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

    const aiText = await this.aiProvider.streamChat({
      context,
      onToken: (token) => {
        this.sendSse(res, {
          type: 'token',
          content: token,
        });
      },
    });

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

    const recentMessages = session.messages
      .slice(-8)
      .map((msg) => `${msg.sender_type}: ${msg.message_text}`)
      .join('\n');

    const context = this.buildFollowUpContext(
    session,
    recentMessages,
    message,
    );

    const aiText = await this.aiProvider.streamChat({
    context,
    onToken: (token) => {
        this.sendSse(res, {
        type: 'token',
        content: token,
        });
    },
    });

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
        user: {
        userId: user.user_id,
        investmentLevel:
            user.investmentLevel?.levelName ?? '미설정',
        },

        question: {
        questionId: question.question_id,
        questionType: question.question_type,
        questionText: question.question_text,
        explanation: question.explanation,
        topic: question.topicName?.topicName ?? '미분류',
        level:
            question.investmentLevel?.levelName ?? '미설정',
        choices: question.choices.map((choice) => ({
            choiceNo: choice.choice_no,
            text: choice.choice_text,
            isCorrect: choice.is_correct,
        })),
        },

        userMessage: message,
    };
    }
    private buildFollowUpContext(
        session: AiChatSession,
        recentMessages: string,
        message: string,
        ) {
        return {
            sessionId: session.session_id,
            user: {
            userId: session.user.user_id,
            investmentLevel:
                session.user.investmentLevel?.levelName ?? '미설정',
            },
            question: {
            questionId: session.question?.question_id ?? null,
            questionType: session.question?.question_type ?? null,
            questionText: session.question?.question_text ?? null,
            explanation: session.question?.explanation ?? null,
            topic: session.question?.topicName?.topicName ?? '미분류',
            level:
                session.question?.investmentLevel?.levelName ?? '미설정',
            choices:
                session.question?.choices?.map((choice) => ({
                choiceNo: choice.choice_no,
                text: choice.choice_text,
                isCorrect: choice.is_correct,
                })) ?? [],
            },
            recentMessages,
            userMessage: message,
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
}