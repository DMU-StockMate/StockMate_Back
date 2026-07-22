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
import { QuizQuestion } from '../../learning/entities/quiz-question.entity';
import { TopicName } from '../../learning/entities/topic-name.entity';
import { GeneratePromptQuestionRequestDto } from '../dto/generate-prompt-question-request.dto';
import { GenerateQuestionRequestDto } from '../dto/generate-question-request.dto';
import { AiLlamaProviderService } from './ai-provider.service';

type QuestionType = 'MULTIPLE_CHOICE' | 'OX';

type GeneratedQuestion = {
  question_type: QuestionType;
  question_text: string;
  explanation: string;
  topic: string;
  level: string;
  reward_cash?: number;
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
    const topicText = this.buildWrongAttemptReviewPrompt(
      wrongAttempts,
      topic.topicName,
      category,
    );

    const generated = await this.aiProvider.generateQuestion({
      user: {
        user_id: userId,
        investment_level: investmentLevel?.levelName ?? 'unset',
      },
      quiz_type: quizType,
      topic: topicText,
      count: dto.count ?? 1,
    });

    return this.saveGeneratedQuestionBatch(generated, {
      topic,
      investmentLevel,
      category,
      details,
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

    const generated = await this.aiProvider.generateQuestion({
      user: {
        user_id: userId,
        investment_level: investmentLevel?.levelName ?? 'unset',
      },
      quiz_type: quizType,
      topic: this.buildPromptQuestionTopic(dto.prompt, category),
      count: dto.count ?? 1,
    });

    return this.saveGeneratedQuestionBatch(generated, {
      topic,
      investmentLevel,
      category,
      details: this.getActiveCategoryDetails(category),
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
    },
  ) {
    this.validateGeneratedQuestion(generated);

    const questionEntity = this.questionRepository.create({
      topic_id: metadata.topic.topicId,
      investment_level_id: metadata.investmentLevel?.investmentLevelId ?? null,
      category_id: metadata.category?.categoryId ?? null,
      question_type: generated.question_type,
      question_text: generated.question_text,
      explanation: generated.explanation,
      reward_cash: generated.reward_cash ?? 1000,
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
