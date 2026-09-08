import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { InvestmentLevel } from '../../learning/entities/investment-level.entity';
import { QuizAttempt } from '../../learning/entities/quiz-attempt.entity';
import { QuizCategory } from '../../learning/entities/quiz-category.entity';
import { QuizCategoryDetail } from '../../learning/entities/quiz-category-detail.entity';
import { QuizChoice } from '../../learning/entities/quiz-choice.entity';
import { QuizQuestionDetail } from '../../learning/entities/quiz-question-detail.entity';
import {
  QuizPoolType,
  QuizQuestion,
  QuizQuestionSource,
  QuizReviewStatus,
  QuizSourceType,
  QuizVisibility,
} from '../../learning/entities/quiz-question.entity';
import { TopicName } from '../../learning/entities/topic-name.entity';
import { GeneratePromptQuestionRequestDto } from '../dto/generate-prompt-question-request.dto';
import { GenerateQuestionRequestDto } from '../dto/generate-question-request.dto';
import { AiLlamaProviderService } from './ai-provider.service';
import { getRewardCashForLevel } from '../../learning/constants/reward-tier';

type QuestionType = 'MULTIPLE_CHOICE' | 'OX';

type GeneratedQuestion = {
  question_type: QuestionType;
  question_text: string;
  explanation: string;
  topic: string;
  level: string;
  reward_cash?: number;
  quality_score?: number;
  qualityScore?: number;
  ai_quality_score?: number;
  aiQualityScore?: number;
  similarity_score?: number;
  similarityScore?: number;
  similar_question_id?: number;
  similarQuestionId?: number;
  review_status?: string;
  reviewStatus?: string;
  choices: Array<{
    choice_no: number;
    text: string;
    is_correct: boolean;
  }>;
};

type GeneratedQuestionBatch = {
  questions: GeneratedQuestion[];
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

    @InjectRepository(QuizCategory)
    private readonly categoryRepository: Repository<QuizCategory>,

    @InjectRepository(QuizQuestionDetail)
    private readonly questionDetailRepository: Repository<QuizQuestionDetail>,

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
    const category = dto.categoryId
      ? await this.findCategory(dto.categoryId)
      : baseQuestion.category;
    const investmentLevel = dto.investmentLevelId
      ? await this.findInvestmentLevel(dto.investmentLevelId)
      : category?.investmentLevel ?? baseQuestion.investmentLevel;
    const quizType = dto.questionType ?? 'MULTIPLE_CHOICE';
    const details = this.getWrongAttemptDetails(wrongAttempts, category);

    const generated = await this.aiProvider.generateReviewQuestion({
      user: {
        user_id: userId,
        investment_level: investmentLevel?.levelName ?? 'unset',
      },
      quiz_type: quizType,
      wrong_answers: this.toWrongAnswerItems(wrongAttempts),
      count: dto.count ?? 1,
    });

    return this.saveGeneratedQuestionBatch(generated, {
      topic,
      investmentLevel,
      category,
      details,
      userId,
      sourceType: QuizSourceType.WRONG_ANSWER,
      sourceQuestionId: baseQuestion.question_id,
      message: 'AI wrong-answer review questions generated.',
    });
  }

  async generatePromptQuestion(
    userId: number,
    dto: GeneratePromptQuestionRequestDto,
  ) {
    const topic = dto.topicId ? await this.findTopic(dto.topicId) : null;
    const category = dto.categoryId
      ? await this.findCategory(dto.categoryId)
      : null;
    const investmentLevel = dto.investmentLevelId
      ? await this.findInvestmentLevel(dto.investmentLevelId)
      : category?.investmentLevel ?? null;
    const quizType = dto.questionType ?? 'MULTIPLE_CHOICE';

    if (!topic) {
      throw new BadRequestException(
        'topicId is required because quiz_questions.topic_id is NOT NULL.',
      );
    }

    const generated = await this.aiProvider.generatePromptQuestion({
      user: {
        user_id: userId,
        investment_level: investmentLevel?.levelName ?? 'unset',
      },
      quiz_type: quizType,
      prompt: this.buildPromptQuestionTopic(dto.prompt, category),
      count: dto.count ?? 1,
    });

    return this.saveGeneratedQuestionBatch(generated, {
      topic,
      investmentLevel,
      category,
      details: this.getActiveCategoryDetails(category),
      userId,
      sourceType: QuizSourceType.PERSONAL_PROMPT,
      sourceQuestionId: null,
      message: 'AI prompt-based questions generated.',
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
        'question.category',
        'question.category.investmentLevel',
        'question.category.details',
        'question.questionDetails',
        'question.questionDetails.detail',
      ],
      order: {
        solved_at: 'DESC',
      },
    });

    if (wrongAttempts.length === 0) {
      throw new NotFoundException(
        'No wrong quiz attempts were found for the requested questions.',
      );
    }

    if (!wrongAttempts[0].question.topicName) {
      throw new BadRequestException(
        'The base wrong question has no topic. topicId is required.',
      );
    }

    return wrongAttempts;
  }

  private buildWrongAttemptReviewPrompt(
    wrongAttempts: QuizAttempt[],
    requestedTopic: string,
    category: QuizCategory | null,
  ) {
    const wrongQuestionSummaries = wrongAttempts.map((attempt, index) => {
      const selectedChoice = attempt.question.choices?.find(
        (choice) => choice.choice_id === attempt.selected_choice_id,
      );
      const correctChoice = attempt.question.choices?.find(
        (choice) => choice.is_correct,
      );
      const details = this.getQuestionDetailNames(attempt.question);

      return [
        `${index + 1}. ${attempt.question.question_text}`,
        `- topic: ${attempt.question.topicName?.topicName ?? 'uncategorized'}`,
        `- category: ${attempt.question.category?.categoryName ?? 'none'}`,
        `- details: ${details.length > 0 ? details.join(', ') : 'none'}`,
        `- explanation: ${attempt.question.explanation ?? ''}`,
        `- selected: ${selectedChoice?.choice_text ?? 'none'}`,
        `- correct: ${correctChoice?.choice_text ?? 'none'}`,
      ].join('\n');
    });

    return [
      `Review topic: ${requestedTopic}`,
      this.buildCategoryContext(category),
      'The user answered the following questions incorrectly in the current quiz set.',
      'Generate new review questions that test the misunderstood concepts without copying the original wording.',
      wrongQuestionSummaries.join('\n\n'),
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  private buildPromptQuestionTopic(
    prompt: string,
    category: QuizCategory | null,
  ) {
    return [this.buildCategoryContext(category), prompt]
      .filter(Boolean)
      .join('\n\n');
  }

  private buildCategoryContext(category: QuizCategory | null) {
    if (!category) {
      return '';
    }

    const details = (category.details ?? [])
      .filter((detail) => detail.status === 'ACTIVE')
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((detail) =>
        [detail.detailName, detail.description].filter(Boolean).join(': '),
      );

    return [
      `Category: ${category.categoryName}`,
      category.description ? `Details: ${category.description}` : '',
      category.problemDirection
        ? `Question direction: ${category.problemDirection}`
        : '',
      details.length > 0 ? `Sub details: ${details.join(' / ')}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private getQuestionDetailNames(question: QuizQuestion) {
    return (question.questionDetails ?? [])
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
      .map((questionDetail) => questionDetail.detail?.detailName)
      .filter((detailName): detailName is string => Boolean(detailName));
  }

  private toWrongAnswerItems(wrongAttempts: QuizAttempt[]) {
    return wrongAttempts.map((attempt) => {
      const primaryQuestionDetail =
        attempt.question.questionDetails?.find(
          (questionDetail) => questionDetail.isPrimary,
        ) ?? attempt.question.questionDetails?.[0];
      const selectedChoice = attempt.question.choices?.find(
        (choice) => choice.choice_id === attempt.selected_choice_id,
      );

      return {
        question_text: attempt.question.question_text,
        question_type: attempt.question.question_type,
        explanation: attempt.question.explanation ?? null,
        topic: attempt.question.topicName?.topicName ?? null,
        detail_code: primaryQuestionDetail?.detail?.detailCode ?? null,
        choices:
          attempt.question.choices?.map((choice) => ({
            choice_no: choice.choice_no,
            text: choice.choice_text,
            is_correct: choice.is_correct,
          })) ?? [],
        selected_choice_no: selectedChoice?.choice_no ?? null,
      };
    });
  }

  private getWrongAttemptDetails(
    wrongAttempts: QuizAttempt[],
    category: QuizCategory | null,
  ) {
    const details = wrongAttempts
      .flatMap((attempt) => attempt.question.questionDetails ?? [])
      .map((questionDetail) => questionDetail.detail)
      .filter((detail): detail is QuizCategoryDetail => Boolean(detail));

    if (details.length === 0) {
      return this.getActiveCategoryDetails(category);
    }

    return [...new Map(details.map((detail) => [detail.detailId, detail])).values()]
      .filter((detail) => detail.status === 'ACTIVE')
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  private getActiveCategoryDetails(category: QuizCategory | null) {
    return (category?.details ?? [])
      .filter((detail) => detail.status === 'ACTIVE')
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  private async findTopic(topicId: number) {
    const topic = await this.topicRepository.findOne({
      where: { topicId },
    });

    if (!topic) {
      throw new NotFoundException('Learning topic not found.');
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
      throw new NotFoundException('Investment level not found.');
    }

    return investmentLevel;
  }

  private async findCategory(categoryId: number) {
    const category = await this.categoryRepository.findOne({
      where: {
        categoryId,
        status: 'ACTIVE',
      },
      relations: ['investmentLevel', 'details'],
    });

    if (!category) {
      throw new NotFoundException('Quiz category not found.');
    }

    return category;
  }

  private async saveGeneratedQuestionBatch(
    generatedBatch: GeneratedQuestionBatch,
    metadata: {
      topic: TopicName;
      investmentLevel: InvestmentLevel | null;
      category: QuizCategory | null;
      details: QuizCategoryDetail[];
      userId: number;
      sourceType: QuizSourceType;
      sourceQuestionId: number | null;
      message: string;
    },
  ) {
    this.validateGeneratedQuestionBatch(generatedBatch);

    const questions = await Promise.all(
      generatedBatch.questions.map((generated) =>
        this.saveGeneratedQuestion(generated, metadata),
      ),
    );

    return {
      message: metadata.message,
      questions,
    };
  }

  private async saveGeneratedQuestion(
    generated: GeneratedQuestion,
    metadata: {
      topic: TopicName;
      investmentLevel: InvestmentLevel | null;
      category: QuizCategory | null;
      details: QuizCategoryDetail[];
      userId: number;
      sourceType: QuizSourceType;
      sourceQuestionId: number | null;
    },
  ) {
    this.validateGeneratedQuestion(generated);
    const quality = this.normalizeQuestionQuality(generated);
    const finalQualityScore = this.calculateFinalQualityScore({
      aiQualityScore: quality.aiQualityScore,
      similarityScore: quality.similarityScore,
    });
    const reviewStatus =
      quality.reviewStatus ??
      this.decideInitialReviewStatus(quality.similarityScore);

    const questionEntity = this.questionRepository.create({
      topic_id: metadata.topic.topicId,
      investment_level_id: metadata.investmentLevel?.investmentLevelId ?? null,
      category_id: metadata.category?.categoryId ?? null,
      ownerUserId: metadata.userId,
      sourceType: metadata.sourceType,
      quizPoolType: QuizPoolType.GENERAL,
      visibility: QuizVisibility.PRIVATE,
      sourceQuestionId: metadata.sourceQuestionId,
      source: QuizQuestionSource.AI,
      reviewStatus,
      aiQualityScore: quality.aiQualityScore,
      finalQualityScore,
      similarityScore: quality.similarityScore,
      similarQuestionId: quality.similarQuestionId,
      question_type: generated.question_type,
      question_text: generated.question_text,
      explanation: generated.explanation,
      reward_cash:
        generated.reward_cash ??
        getRewardCashForLevel(metadata.investmentLevel?.investmentLevelId),
      status: 'ACTIVE',
    });
    const question = await this.questionRepository.save(questionEntity);

    await this.saveQuestionDetails(question, metadata.details);

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
      questionId: question.question_id,
      questionText: question.question_text,
      questionType: question.question_type,
      explanation: question.explanation,
      rewardCash: question.reward_cash,
      topic: metadata.topic.topicName ?? generated.topic,
      level: metadata.investmentLevel?.levelName ?? generated.level,
      sourceType: question.sourceType,
      quizPoolType: question.quizPoolType,
      visibility: question.visibility,
      source: question.source,
      reviewStatus: question.reviewStatus,
      aiQualityScore: question.aiQualityScore,
      finalQualityScore: question.finalQualityScore,
      similarityScore: question.similarityScore,
      similarQuestionId: question.similarQuestionId,
      category: metadata.category
        ? {
            categoryId: metadata.category.categoryId,
            categoryName: metadata.category.categoryName,
          }
        : null,
      details:
        metadata.details.map((detail) => ({
          detailId: detail.detailId,
          detailName: detail.detailName,
        })),
      choices: savedChoices.map((choice) => ({
        choiceId: choice.choice_id,
        choiceNo: choice.choice_no,
        text: choice.choice_text,
        isCorrect: choice.is_correct,
      })),
    };
  }

  private async saveQuestionDetails(
    question: QuizQuestion,
    details: QuizCategoryDetail[],
  ) {
    if (details.length === 0) {
      return;
    }

    const questionDetails = details.map((detail, index) =>
      this.questionDetailRepository.create({
        questionId: question.question_id,
        detailId: detail.detailId,
        isPrimary: index === 0,
      }),
    );

    await this.questionDetailRepository.save(questionDetails);
  }

  private normalizeQuestionQuality(generated: GeneratedQuestion) {
    const aiQualityScore = this.toNullableInteger(
      generated.aiQualityScore ??
        generated.ai_quality_score ??
        generated.qualityScore ??
        generated.quality_score,
    );
    const similarityScore = this.toNullableNumber(
      generated.similarityScore ?? generated.similarity_score,
    );
    const similarQuestionId = this.toNullableInteger(
      generated.similarQuestionId ?? generated.similar_question_id,
    );
    const reviewStatus = this.toReviewStatus(
      generated.reviewStatus ?? generated.review_status,
    );

    // AI 서버가 유사도/품질 필드를 응답하면 저장하고, 없으면 null로 유지한다.
    return {
      aiQualityScore,
      similarityScore,
      similarQuestionId,
      reviewStatus,
    };
  }

  private calculateFinalQualityScore(params: {
    aiQualityScore: number | null;
    similarityScore: number | null;
    accuracyRate?: number | null;
    reportCount?: number | null;
  }) {
    let score = params.aiQualityScore ?? 70;

    if (params.similarityScore !== null) {
      if (params.similarityScore >= 0.9) {
        score -= 40;
      } else if (params.similarityScore >= 0.85) {
        score -= 25;
      } else if (params.similarityScore >= 0.8) {
        score -= 10;
      }
    }

    if (params.accuracyRate !== undefined && params.accuracyRate !== null) {
      if (params.accuracyRate >= 0.95) {
        score -= 10;
      } else if (params.accuracyRate <= 0.2) {
        score -= 15;
      }
    }

    score -= (params.reportCount ?? 0) * 5;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private decideInitialReviewStatus(similarityScore: number | null) {
    if (similarityScore !== null && similarityScore >= 0.85) {
      return QuizReviewStatus.REVIEW_REQUIRED;
    }

    return QuizReviewStatus.PENDING;
  }

  private toReviewStatus(value: unknown) {
    if (
      typeof value === 'string' &&
      Object.values(QuizReviewStatus).includes(value as QuizReviewStatus)
    ) {
      return value as QuizReviewStatus;
    }

    return null;
  }

  private toNullableInteger(value: unknown) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed = Number(value);

    return Number.isInteger(parsed) ? parsed : null;
  }

  private toNullableNumber(value: unknown) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  private validateGeneratedQuestionBatch(generatedBatch: GeneratedQuestionBatch) {
    if (!generatedBatch || !Array.isArray(generatedBatch.questions)) {
      throw new BadRequestException(
        'AI question generation response must contain a questions array.',
      );
    }

    if (generatedBatch.questions.length === 0) {
      throw new BadRequestException('AI question generation response is empty.');
    }
  }

  private validateGeneratedQuestion(generated: GeneratedQuestion) {
    if (!generated) {
      throw new BadRequestException('AI question generation response is empty.');
    }

    if (!['MULTIPLE_CHOICE', 'OX'].includes(generated.question_type)) {
      throw new BadRequestException('AI question type is invalid.');
    }

    if (!generated.question_text) {
      throw new BadRequestException('AI question text is empty.');
    }

    if (!generated.explanation) {
      throw new BadRequestException('AI question explanation is empty.');
    }

    if (!Array.isArray(generated.choices)) {
      throw new BadRequestException('AI choices format is invalid.');
    }

    const correctCount = generated.choices.filter(
      (choice) => choice.is_correct === true,
    ).length;

    if (correctCount !== 1) {
      throw new BadRequestException('Exactly one choice must be correct.');
    }

    if (generated.question_type === 'OX' && generated.choices.length !== 2) {
      throw new BadRequestException('OX questions must have exactly 2 choices.');
    }

    if (
      generated.question_type === 'MULTIPLE_CHOICE' &&
      generated.choices.length !== 4
    ) {
      throw new BadRequestException(
        'Multiple-choice questions must have exactly 4 choices.',
      );
    }
  }
}
