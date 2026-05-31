import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { QuizQuestion } from '../../learning/entities/quiz-question.entity';
import { QuizChoice } from '../../learning/entities/quiz-choice.entity';
import { TopicName } from '../../learning/entities/topic-name.entity';
import { InvestmentLevel } from '../../learning/entities/investment-level.entity';

import { AiLlamaProviderService } from './ai-provide.service';
import { GenerateQuestionRequestDto } from '../dto/generate-question-request.dto';

@Injectable()
export class AiQuestionService {
  constructor(
    @InjectRepository(QuizQuestion)
    private readonly questionRepository: Repository<QuizQuestion>,

    @InjectRepository(QuizChoice)
    private readonly choiceRepository: Repository<QuizChoice>,

    @InjectRepository(TopicName)
    private readonly topicRepository: Repository<TopicName>,

    @InjectRepository(InvestmentLevel)
    private readonly investmentLevelRepository: Repository<InvestmentLevel>,

    private readonly aiProvider: AiLlamaProviderService,
  ) {}

  async generateQuestion(dto: GenerateQuestionRequestDto) {
    const topic = await this.topicRepository.findOne({
      where: { topicId: dto.topicId },
    });

    if (!topic) {
      throw new NotFoundException('학습 주제를 찾을 수 없습니다.');
    }

    const investmentLevel =
      await this.investmentLevelRepository.findOne({
        where: {
          investmentLevelId: dto.investmentLevelId,
        },
      });

    if (!investmentLevel) {
      throw new NotFoundException('투자 등급을 찾을 수 없습니다.');
    }

    const context = {
      topic: {
        topic_id: topic.topicId,
        topic_name: topic.topicName,
        description: topic.description,
      },
      investment_level: {
        investment_level_id:
          investmentLevel.investmentLevelId,
        level_name: investmentLevel.levelName,
        description: investmentLevel.description,
      },
      question_type: dto.questionType,
    };

    const generated =
      await this.aiProvider.generateQuestion(context);

    this.validateGeneratedQuestion(generated);

    const question = await this.questionRepository.save(
      this.questionRepository.create({
        topic_id: dto.topicId,
        investment_level_id: dto.investmentLevelId,
        question_type: generated.question_type,
        question_text: generated.question_text,
        explanation: generated.explanation,
        reward_cash: generated.reward_cash ?? 1000,
        status: 'ACTIVE',
      }),
    );

    const choices = generated.choices.map((choice) =>
      this.choiceRepository.create({
        question,
        choice_no: choice.choice_no,
        choice_text: choice.text,
        is_correct: choice.is_correct,
      }),
    );

    const savedChoices =
      await this.choiceRepository.save(choices);

    return {
      message: 'AI 문제가 생성되었습니다.',
      questionId: question.question_id,
      questionText: question.question_text,
      questionType: question.question_type,
      explanation: question.explanation,
      rewardCash: question.reward_cash,
      topic: topic.topicName,
      level: investmentLevel.levelName,
      choices: savedChoices.map((choice) => ({
        choiceId: choice.choice_id,
        choiceNo: choice.choice_no,
        text: choice.choice_text,
        isCorrect: choice.is_correct,
      })),
    };
  }

  private validateGeneratedQuestion(generated: any) {
    if (!generated) {
      throw new BadRequestException(
        'AI 문제 생성 응답이 비어 있습니다.',
      );
    }

    if (
      !['MULTIPLE_CHOICE', 'OX'].includes(
        generated.question_type,
      )
    ) {
      throw new BadRequestException(
        'AI 문제 유형이 올바르지 않습니다.',
      );
    }

    if (!generated.question_text) {
      throw new BadRequestException(
        'AI 문제 내용이 없습니다.',
      );
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
        'OX 문제는 선택지가 2개여야 합니다.',
      );
    }

    if (
      generated.question_type === 'MULTIPLE_CHOICE' &&
      generated.choices.length < 2
    ) {
      throw new BadRequestException(
        '객관식 문제는 선택지가 2개 이상이어야 합니다.',
      );
    }
  }
}