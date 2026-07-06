import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { InvestmentLevel } from '../../learning/entities/investment-level.entity';
import { QuizAttempt } from '../../learning/entities/quiz-attempt.entity';
import { QuizChoice } from '../../learning/entities/quiz-choice.entity';
import { QuizQuestion } from '../../learning/entities/quiz-question.entity';
import { TopicName } from '../../learning/entities/topic-name.entity';
import { GeneratePromptQuestionRequestDto } from '../dto/generate-prompt-question-request.dto';
import { GenerateQuestionRequestDto } from '../dto/generate-question-request.dto';
import { AiLlamaProviderService } from './ai-provider.service';

type QuestionType = 'MULTIPLE_CHOICE' | 'OX';

type GeneratedQuestion = {
  question_type: QuestionType;
  question_text: string;
  explanation?: string;
  reward_cash?: number;
  choices: Array<{
    choice_no: number;
    text: string;
    is_correct: boolean;
  }>;
};

@Injectable()
export class AiQuestionService {
  constructor(
    @InjectRepository(QuizQuestion)
    private readonly questionRepository: Repository<QuizQuestion>,

    @InjectRepository(QuizChoice)
    private readonly choiceRepository: Repository<QuizChoice>,

    @InjectRepository(QuizAttempt)
    private readonly attemptRepository: Repository<QuizAttempt>,

    @InjectRepository(TopicName)
    private readonly topicRepository: Repository<TopicName>,

    @InjectRepository(InvestmentLevel)
    private readonly investmentLevelRepository: Repository<InvestmentLevel>,

    private readonly aiProvider: AiLlamaProviderService,
  ) {}

  async generateQuestion(userId: number, dto: GenerateQuestionRequestDto) {
    const wrongAttempts = await this.findWrongAttemptsInQuestions(
      userId,
      dto.questionIds,
    );
    const baseQuestion = wrongAttempts[0].question;
    const topic = dto.topicId
      ? await this.findTopic(dto.topicId)
      : baseQuestion.topicName;
    const investmentLevel = dto.investmentLevelId
      ? await this.findInvestmentLevel(dto.investmentLevelId)
      : baseQuestion.investmentLevel;
    const questionType = dto.questionType ?? 'MULTIPLE_CHOICE';

    const context = {
      generation_mode: 'WRONG_QUESTION_REVIEW',
      user: {
        user_id: userId,
        investment_level: investmentLevel?.levelName ?? '미설정',
      },
      quiz_type: questionType,
      topic: topic?.topicName ?? '미분류',
      wrong_questions: wrongAttempts.map((attempt) => ({
        question_id: attempt.question.question_id,
        question_type: attempt.question.question_type,
        question_text: attempt.question.question_text,
        explanation: attempt.question.explanation,
        topic: attempt.question.topicName?.topicName ?? null,
        investment_level:
          attempt.question.investmentLevel?.levelName ?? null,
        selected_choice_id: attempt.selected_choice_id,
        choices:
          attempt.question.choices?.map((choice) => ({
            choice_no: choice.choice_no,
            text: choice.choice_text,
            is_correct: choice.is_correct,
            selected: choice.choice_id === attempt.selected_choice_id,
          })) ?? [],
      })),
      instruction:
        '사용자가 틀린 문제의 약점을 보완할 수 있는 새 학습 문제를 생성하세요.',
    };

    const generated = await this.aiProvider.generateQuestion(context);

    return this.saveGeneratedQuestion(generated, {
      topic,
      investmentLevel,
      message: 'AI 오답 기반 문제가 생성되었습니다.',
    });
  }

  async generatePromptQuestion(
    userId: number,
    dto: GeneratePromptQuestionRequestDto,
  ) {
    const topic = dto.topicId ? await this.findTopic(dto.topicId) : null;
    const investmentLevel = dto.investmentLevelId
      ? await this.findInvestmentLevel(dto.investmentLevelId)
      : null;
    const questionType = dto.questionType ?? 'MULTIPLE_CHOICE';

    const context = {
      generation_mode: 'PROMPT',
      user: {
        user_id: userId,
        investment_level: investmentLevel?.levelName ?? '미설정',
      },
      quiz_type: questionType,
      topic: topic?.topicName ?? '사용자 프롬프트',
      prompt: dto.prompt,
      instruction:
        '사용자 프롬프트를 반영하되 학습 문제 형식에 맞는 새 문제를 생성하세요.',
    };

    const generated = await this.aiProvider.generateQuestion(context);

    return this.saveGeneratedQuestion(generated, {
      topic,
      investmentLevel,
      message: 'AI 프롬프트 기반 문제가 생성되었습니다.',
    });
  }

  private async findWrongAttemptsInQuestions(
    userId: number,
    questionIds: number[],
  ) {
    const wrongAttempts = await this.attemptRepository.find({
      where: {
        user_id: userId,
        question_id: In(questionIds),
        is_correct: false,
      },
      relations: [
        'question',
        'question.choices',
        'question.topicName',
        'question.investmentLevel',
      ],
      order: {
        solved_at: 'DESC',
      },
    });

    if (wrongAttempts.length === 0) {
      throw new NotFoundException('틀린 문제 기록을 찾을 수 없습니다.');
    }

    return wrongAttempts;
  }

  private async findTopic(topicId: number) {
    const topic = await this.topicRepository.findOne({
      where: { topicId },
    });

    if (!topic) {
      throw new NotFoundException('학습 주제를 찾을 수 없습니다.');
    }

    return topic;
  }

  private async findInvestmentLevel(investmentLevelId: number) {
    const investmentLevel = await this.investmentLevelRepository.findOne({
      where: {
        investmentLevelId,
      },
    });

    if (!investmentLevel) {
      throw new NotFoundException('투자 등급을 찾을 수 없습니다.');
    }

    return investmentLevel;
  }

  private async saveGeneratedQuestion(
    generated: GeneratedQuestion,
    metadata: {
      topic: TopicName | null;
      investmentLevel: InvestmentLevel | null;
      message: string;
    },
  ) {
    this.validateGeneratedQuestion(generated);

    const questionEntity = this.questionRepository.create({
        topic_id: metadata.topic?.topicId ?? null,
        investment_level_id:
          metadata.investmentLevel?.investmentLevelId ?? null,
        question_type: generated.question_type,
        question_text: generated.question_text,
        explanation: generated.explanation ?? '',
        reward_cash: generated.reward_cash ?? 1000,
        status: 'ACTIVE',
      });
    const question = await this.questionRepository.save(questionEntity);

    const choices = generated.choices.map((choice) =>
      this.choiceRepository.create({
        question,
        choice_no: choice.choice_no,
        choice_text: choice.text,
        is_correct: choice.is_correct,
      }),
    );

    const savedChoices = await this.choiceRepository.save(choices);

    return {
      message: metadata.message,
      questionId: question.question_id,
      questionText: question.question_text,
      questionType: question.question_type,
      explanation: question.explanation,
      rewardCash: question.reward_cash,
      topic: metadata.topic?.topicName ?? null,
      level: metadata.investmentLevel?.levelName ?? null,
      choices: savedChoices.map((choice) => ({
        choiceId: choice.choice_id,
        choiceNo: choice.choice_no,
        text: choice.choice_text,
        isCorrect: choice.is_correct,
      })),
    };
  }

  private validateGeneratedQuestion(generated: GeneratedQuestion) {
    if (!generated) {
      throw new BadRequestException(
        'AI 문제 생성 응답이 비어 있습니다.',
      );
    }

    if (
      !['MULTIPLE_CHOICE', 'OX'].includes(generated.question_type)
    ) {
      throw new BadRequestException(
        'AI 문제 유형이 올바르지 않습니다.',
      );
    }

    if (!generated.question_text) {
      throw new BadRequestException('AI 문제 내용이 없습니다.');
    }

    if (!Array.isArray(generated.choices)) {
      throw new BadRequestException(
        'AI 선택지 형식이 올바르지 않습니다.',
      );
    }

    const correctCount = generated.choices.filter(
      (choice) => choice.is_correct === true,
    ).length;

    if (correctCount !== 1) {
      throw new BadRequestException(
        '정답 선택지는 반드시 1개여야 합니다.',
      );
    }

    if (
      generated.question_type === 'OX' &&
      generated.choices.length !== 2
    ) {
      throw new BadRequestException(
        'OX 문제의 선택지는 2개여야 합니다.',
      );
    }

    if (
      generated.question_type === 'MULTIPLE_CHOICE' &&
      generated.choices.length < 2
    ) {
      throw new BadRequestException(
        '객관식 문제의 선택지는 2개 이상이어야 합니다.',
      );
    }
  }
}
