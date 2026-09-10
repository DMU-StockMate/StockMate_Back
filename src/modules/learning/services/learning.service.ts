import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';

import { TradingService } from '../../trading/services/trading.service';
import { User } from '../../users/entities/user.entity';
import { FindQuestionsQueryDto } from '../dto/find-questions-query.dto';
import { RecommendedQuestionQueryDto } from '../dto/recommended-question-query.dto';
import { QuestionResponseDto } from '../dto/response.dto';
import { SubmitAnswerDto } from '../dto/submit-answer.dto';
import { TopicResponseDto } from '../dto/topic-response.dto';
import { LearningConceptBlock } from '../entities/learning-concept-block.entity';
import { LearningConceptQuiz } from '../entities/learning-concept-quiz.entity';
import { LearningConcept } from '../entities/learning-concept.entity';
import { QuizAttempt } from '../entities/quiz-attempt.entity';
import { QuizBookmark } from '../entities/quiz-bookmark.entity';
import { QuizCategory } from '../entities/quiz-category.entity';
import {
  QuizPoolType,
  QuizQuestion,
  QuizReviewStatus,
  QuizSourceType,
  QuizVisibility,
} from '../entities/quiz-question.entity';

type RecommendationMode = 'mixed' | 'weakness' | 'level' | 'review';

type RecommendationReasonType =
  | 'WEAK_DETAIL'
  | 'WEAK_CATEGORY'
  | 'WEAK_TOPIC'
  | 'RECENT_LEARNING'
  | 'BOOKMARK_RELATED'
  | 'LEVEL_MATCH'
  | 'COMMON_LEVEL'
  | 'REVIEW';

@Injectable()
export class LearningService {
  constructor(
    @InjectRepository(QuizQuestion)
    private readonly questionRepository: Repository<QuizQuestion>,

    @InjectRepository(QuizAttempt)
    private readonly attemptRepository: Repository<QuizAttempt>,

    @InjectRepository(QuizBookmark)
    private readonly bookmarkRepository: Repository<QuizBookmark>,

    @InjectRepository(QuizCategory)
    private readonly categoryRepository: Repository<QuizCategory>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(LearningConcept)
    private readonly conceptRepository: Repository<LearningConcept>,

    @InjectRepository(LearningConceptBlock)
    private readonly conceptBlockRepository: Repository<LearningConceptBlock>,

    @InjectRepository(LearningConceptQuiz)
    private readonly conceptQuizRepository: Repository<LearningConceptQuiz>,

    private readonly tradingService: TradingService,
  ) {}

  async findAllTopics(): Promise<TopicResponseDto[]> {
    const categories = await this.categoryRepository.find({
      where: { status: 'ACTIVE' },
      order: { investmentLevelId: 'ASC', sortOrder: 'ASC', categoryId: 'ASC' },
    });

    return categories.map((category) => ({
      topicId: category.categoryId,
      categoryId: category.categoryId,
      investmentLevelId: category.investmentLevelId,
      topicName: category.categoryName,
      categoryName: category.categoryName,
      description: category.problemDirection ?? category.description,
    }));
  }

  async findAllConcepts(topicId?: number, investmentLevelId?: number) {
    const where: FindOptionsWhere<LearningConcept> = {};
    if (topicId) where.topicId = topicId;
    if (investmentLevelId) where.investmentLevelId = investmentLevelId;

    const concepts = await this.conceptRepository.find({
      where,
      relations: ['topic', 'investmentLevel'],
      order: { investmentLevelId: 'ASC', sortOrder: 'ASC' },
    });

    return concepts.map((concept) => this.toConceptSummary(concept));
  }

  async findConceptBySlug(slug: string) {
    const concept = await this.conceptRepository.findOne({
      where: { slug },
      relations: ['topic', 'investmentLevel'],
    });

    if (!concept) {
      throw new NotFoundException('개념을 찾을 수 없습니다.');
    }

    const blocks = await this.conceptBlockRepository.find({
      where: { conceptId: concept.conceptId, isVisible: true },
      order: { sortOrder: 'ASC' },
    });

    const conceptQuiz = await this.conceptQuizRepository.findOne({
      where: { conceptId: concept.conceptId },
      relations: ['question', 'question.choices'],
    });
    const quizQuestion = conceptQuiz?.question?.status === 'ACTIVE' ? conceptQuiz.question : null;

    return {
      ...this.toConceptSummary(concept),
      prerequisiteText: concept.prerequisiteText,
      blocks: blocks.map((block) => ({
        blockId: block.blockId,
        blockType: block.blockType,
        sortOrder: block.sortOrder,
        title: block.title,
        contentText: block.contentText,
        contentJson: block.contentJson,
        styleVariant: block.styleVariant,
      })),
      quiz: quizQuestion
        ? {
            questionId: quizQuestion.question_id,
            questionText: quizQuestion.question_text,
            choices: quizQuestion.choices.map((choice) => ({
              id: choice.choice_id,
              text: choice.choice_text,
            })),
          }
        : null,
    };
  }

  private toConceptSummary(concept: LearningConcept) {
    return {
      conceptId: concept.conceptId,
      slug: concept.slug,
      title: concept.title,
      summary: concept.summary,
      learningObjectives: concept.learningObjectives,
      estimatedMinutes: concept.estimatedMinutes,
      sortOrder: concept.sortOrder,
      thumbnailUrl: concept.thumbnailUrl,
      status: concept.status,
      topic: concept.topic
        ? { topicId: concept.topic.topicId, topicName: concept.topic.topicName }
        : null,
      investmentLevel: concept.investmentLevel
        ? {
            investmentLevelId: concept.investmentLevel.investmentLevelId,
            levelName: concept.investmentLevel.levelName,
          }
        : null,
    };
  }

  async findAllQuestions(userId: number, query: FindQuestionsQueryDto) {
    const publicWhere: FindOptionsWhere<QuizQuestion> = {
      status: 'ACTIVE',
      quizPoolType: In([QuizPoolType.GENERAL, QuizPoolType.BOTH]),
      visibility: QuizVisibility.PUBLIC,
      reviewStatus: QuizReviewStatus.ACTIVE,
    };
    const privateWhere: FindOptionsWhere<QuizQuestion> = {
      status: 'ACTIVE',
      quizPoolType: In([QuizPoolType.GENERAL, QuizPoolType.BOTH]),
      visibility: QuizVisibility.PRIVATE,
      ownerUserId: userId,
    };

    if (query.categoryId ?? query.topicId) {
      publicWhere.category_id = query.categoryId ?? query.topicId;
      privateWhere.category_id = query.categoryId ?? query.topicId;
    }

    if (query.investmentLevelId) {
      publicWhere.investment_level_id = query.investmentLevelId;
      privateWhere.investment_level_id = query.investmentLevelId;
    }

    return this.questionRepository.find({
      where: [publicWhere, privateWhere],
      relations: ['choices', 'category'],
      order: {
        question_id: 'DESC',
      },
    });
  }

  async getRecommendedQuestions(
    userId: number,
    query: RecommendedQuestionQueryDto,
  ) {
    const count = query.count ?? 10;
    const mode = query.mode ?? 'mixed';
    const excludeSolved = query.excludeSolved ?? true;
    const includeReview = query.includeReview ?? true;
    const user = await this.userRepository.findOne({
      where: { user_id: userId },
      relations: ['investmentLevel'],
    });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const [attempts, bookmarks, questions] = await Promise.all([
      this.attemptRepository.find({
        where: { user_id: userId },
        relations: [
          'question',
          'question.topicName',
          'question.category',
          'question.questionDetails',
          'question.questionDetails.detail',
        ],
        order: { solved_at: 'DESC' },
      }),
      this.bookmarkRepository.find({
        where: { user_id: userId },
        relations: [
          'question',
          'question.topicName',
          'question.category',
          'question.questionDetails',
          'question.questionDetails.detail',
        ],
        order: { created_at: 'DESC' },
      }),
      this.questionRepository.find({
        where: [
          {
            status: 'ACTIVE',
            quizPoolType: In([QuizPoolType.GENERAL, QuizPoolType.BOTH]),
            visibility: QuizVisibility.PUBLIC,
            reviewStatus: QuizReviewStatus.ACTIVE,
          },
          {
            status: 'ACTIVE',
            quizPoolType: In([QuizPoolType.GENERAL, QuizPoolType.BOTH]),
            visibility: QuizVisibility.PRIVATE,
            ownerUserId: userId,
          },
        ],
        relations: [
          'topicName',
          'category',
          'questionDetails',
          'questionDetails.detail',
        ],
      }),
    ]);

    const attemptByQuestionId = new Map(
      attempts.map((attempt) => [attempt.question_id, attempt]),
    );
    const bookmarkQuestionIds = new Set(
      bookmarks.map((bookmark) => bookmark.question_id),
    );
    const wrongAttempts = attempts.filter(
      (attempt) => attempt.is_correct === false,
    );
    const recentAttempts = attempts.slice(0, 5);
    const weakTopics = this.countTopics(wrongAttempts);
    const weakCategories = this.countCategories(wrongAttempts);
    const weakDetails = this.countDetailsFromAttempts(wrongAttempts);
    const recentSignals = this.buildAttemptSignals(recentAttempts);
    const bookmarkSignals = this.buildBookmarkSignals(bookmarks);
    const scoringContext = {
      userLevelId: user.investment_level_id,
      mode,
      attemptByQuestionId,
      bookmarkQuestionIds,
      weakTopicIds: new Set(weakTopics.map((topic) => topic.topicId)),
      weakCategoryIds: new Set(
        weakCategories.map((category) => category.categoryId),
      ),
      weakDetailIds: new Set(weakDetails.map((detail) => detail.detailId)),
      recentTopicIds: recentSignals.topicIds,
      recentCategoryIds: recentSignals.categoryIds,
      recentDetailIds: recentSignals.detailIds,
      bookmarkCategoryIds: bookmarkSignals.categoryIds,
      bookmarkDetailIds: bookmarkSignals.detailIds,
    };

    const unsolvedCandidates = questions.filter(
      (question) => !attemptByQuestionId.has(question.question_id),
    );
    const baseCandidates =
      mode === 'review'
        ? questions.filter((question) => {
            const attempt = attemptByQuestionId.get(question.question_id);
            return attempt?.is_correct === false;
          })
        : excludeSolved
          ? unsolvedCandidates
          : questions;

    const selected = this.rankQuestions(baseCandidates, scoringContext).slice(
      0,
      count,
    );

    if (selected.length < count && includeReview && mode !== 'review') {
      const selectedIds = new Set(
        selected.map((item) => item.question.question_id),
      );
      const reviewCandidates = questions.filter((question) => {
        const attempt = attemptByQuestionId.get(question.question_id);
        return attempt?.is_correct === false && !selectedIds.has(question.question_id);
      });

      selected.push(
        ...this.rankQuestions(reviewCandidates, scoringContext).slice(
          0,
          count - selected.length,
        ),
      );
    }

    return {
      strategy: this.toStrategy(mode),
      userLevel: user.investmentLevel
        ? {
            investmentLevelId: user.investmentLevel.investmentLevelId,
            levelName: user.investmentLevel.levelName,
          }
        : null,
      summary: {
        solvedCount: attempts.length,
        wrongCount: wrongAttempts.length,
        weakTopics,
        weakCategories,
        weakDetails,
      },
      questions: selected.map((item) =>
        this.toRecommendedQuestionResponse(
          item.question,
          item.reason,
          item.reasonType,
          attemptByQuestionId,
          bookmarkQuestionIds,
        ),
      ),
      aiSuggestion: {
        needed: selected.length < count,
        reason:
          selected.length < count
            ? '추천 가능한 기존 문제가 부족합니다. AI 보충 문제 생성을 검토할 수 있습니다.'
            : null,
      },
    };
  }

  async findQuestionById(
    userId: number,
    questionId: number,
  ): Promise<QuestionResponseDto> {
    const question = await this.findQuestionEntityById(userId, questionId);

    return {
      questionId: question.question_id,
      questionText: question.question_text,
      choices: question.choices.map((choice) => ({
        id: choice.choice_id,
        text: choice.choice_text,
      })),
    };
  }

  async submitAnswer(userId: number, questionId: number, dto: SubmitAnswerDto) {
    const question = await this.findQuestionEntityById(userId, questionId);

    const selectedChoice = question.choices.find(
      (choice) => choice.choice_id === dto.selectedChoiceId,
    );

    if (!selectedChoice) {
      throw new BadRequestException('해당 문제에 속하지 않는 선택지입니다.');
    }

    const isCorrect = selectedChoice.is_correct;
    const reward =
      isCorrect && this.isRewardableQuestion(question) ? question.reward_cash : 0;

    const previousAttempt = await this.attemptRepository.findOne({
      where: { user_id: userId, question_id: questionId },
    });
    const alreadyRewarded = previousAttempt?.is_correct === true;

    // 같은 사용자가 같은 문제를 이미 푼 경우 기존 기록 삭제
    await this.attemptRepository.delete({
      user_id: userId,
      question_id: questionId,
    });

    const attempt = this.attemptRepository.create({
      user_id: userId,
      question_id: questionId,
      selected_choice_id: dto.selectedChoiceId,
      is_correct: isCorrect,
      reward_cash_earned: reward,
    });

    const savedAttempt = await this.attemptRepository.save(attempt);

    // ponytail: 이미 보상받은 문제를 재제출해 다시 맞혀도 중복 지급하지 않음.
    // 반대로 맞힌 문제를 재제출해 틀리게 바뀌는 경우 이미 지급된 금액을 회수하지는 않음
    // (실제 화폐가 아닌 학습용 시뮬레이션 잔액이라 영향이 제한적) — 회수가 필요해지면 여기서 처리.
    if (isCorrect && !alreadyRewarded && reward > 0) {
      await this.tradingService.creditReward(
        userId,
        reward,
        savedAttempt.attempt_id,
      );
    }

    return {
      message: '정답 제출이 완료되었습니다.',
      questionId,
      selectedChoiceId: dto.selectedChoiceId,
      correct: isCorrect,
      reward,
      explanation: question.explanation,
    };
  }

  async getHistories(userId: number) {
    return this.attemptRepository.find({
      where: {
        user_id: userId,
      },
      relations: ['question'],
      order: {
        solved_at: 'DESC',
      },
    });
  }

  async getStatistics(userId: number) {
    const attempts = await this.attemptRepository.find({
      where: {
        user_id: userId,
      },
    });

    const total = attempts.length;
    const correct = attempts.filter((attempt) => attempt.is_correct).length;
    const wrong = total - correct;

    return {
      total,
      correct,
      wrong,
      accuracy: total === 0 ? 0 : Number(((correct / total) * 100).toFixed(1)),
    };
  }

  async getWrongNotes(userId: number) {
    return this.attemptRepository.find({
      where: {
        user_id: userId,
        is_correct: false,
      },
      relations: ['question'],
      order: {
        solved_at: 'DESC',
      },
    });
  }

  async getWrongNote(userId: number, questionId: number) {
    const wrongNote = await this.attemptRepository.findOne({
      where: {
        user_id: userId,
        question_id: questionId,
        is_correct: false,
      },
      relations: ['question'],
      order: {
        solved_at: 'DESC',
      },
    });

    if (!wrongNote) {
      throw new NotFoundException('해당 오답 기록을 찾을 수 없습니다.');
    }

    return wrongNote;
  }

  async deleteWrongNote(userId: number, questionId: number) {
    const wrongNotes = await this.attemptRepository.find({
      where: {
        user_id: userId,
        question_id: questionId,
        is_correct: false,
      },
    });

    if (wrongNotes.length === 0) {
      throw new NotFoundException('삭제할 오답 기록을 찾을 수 없습니다.');
    }

    await this.attemptRepository.remove(wrongNotes);

    return {
      message: '오답 기록이 삭제되었습니다.',
      questionId,
    };
  }

  async addBookmark(userId: number, questionId: number) {
    await this.findQuestionById(userId, questionId);

    const exists = await this.bookmarkRepository.findOne({
      where: {
        user_id: userId,
        question_id: questionId,
      },
    });

    if (exists) {
      throw new ConflictException('이미 북마크한 문제입니다.');
    }

    const bookmark = this.bookmarkRepository.create({
      user_id: userId,
      question_id: questionId,
    });

    await this.bookmarkRepository.save(bookmark);

    return {
      message: '북마크가 추가되었습니다.',
      questionId,
    };
  }

  async getBookmarks(userId: number) {
    return this.bookmarkRepository.find({
      where: {
        user_id: userId,
      },
      relations: ['question'],
      order: {
        created_at: 'DESC',
      },
    });
  }

  async deleteBookmark(userId: number, questionId: number) {
    const bookmark = await this.bookmarkRepository.findOne({
      where: {
        user_id: userId,
        question_id: questionId,
      },
    });

    if (!bookmark) {
      throw new NotFoundException('삭제할 북마크를 찾을 수 없습니다.');
    }

    await this.bookmarkRepository.remove(bookmark);

    return {
      message: '북마크가 삭제되었습니다.',
      questionId,
    };
  }

  private rankQuestions(
    questions: QuizQuestion[],
    context: {
      userLevelId: number | null;
      mode: RecommendationMode;
      attemptByQuestionId: Map<number, QuizAttempt>;
      bookmarkQuestionIds: Set<number>;
      weakTopicIds: Set<number>;
      weakCategoryIds: Set<number>;
      weakDetailIds: Set<number>;
      recentTopicIds: Set<number>;
      recentCategoryIds: Set<number>;
      recentDetailIds: Set<number>;
      bookmarkCategoryIds: Set<number>;
      bookmarkDetailIds: Set<number>;
    },
  ) {
    return questions
      .map((question) => ({
        question,
        ...this.scoreQuestion(question, context),
      }))
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }

        return b.question.question_id - a.question.question_id;
      });
  }

  private scoreQuestion(
    question: QuizQuestion,
    context: {
      userLevelId: number | null;
      mode: RecommendationMode;
      attemptByQuestionId: Map<number, QuizAttempt>;
      bookmarkQuestionIds: Set<number>;
      weakTopicIds: Set<number>;
      weakCategoryIds: Set<number>;
      weakDetailIds: Set<number>;
      recentTopicIds: Set<number>;
      recentCategoryIds: Set<number>;
      recentDetailIds: Set<number>;
      bookmarkCategoryIds: Set<number>;
      bookmarkDetailIds: Set<number>;
    },
  ): {
    score: number;
    reason: string;
    reasonType: RecommendationReasonType;
  } {
    let score = 0;
    let reasonType: RecommendationReasonType = 'LEVEL_MATCH';
    let reason = '사용자 투자 수준에 맞는 문제입니다.';
    const attempt = context.attemptByQuestionId.get(question.question_id);
    const questionDetailIds = this.getQuestionDetailIds(question);
    const hasWeakDetail = questionDetailIds.some((detailId) =>
      context.weakDetailIds.has(detailId),
    );
    const hasRecentDetail = questionDetailIds.some((detailId) =>
      context.recentDetailIds.has(detailId),
    );
    const hasBookmarkDetail = questionDetailIds.some((detailId) =>
      context.bookmarkDetailIds.has(detailId),
    );

    if (
      context.userLevelId !== null &&
      question.investment_level_id === context.userLevelId
    ) {
      score += context.mode === 'level' ? 50 : 30;
      reasonType = 'LEVEL_MATCH';
      reason = '사용자 투자 수준과 일치하는 문제입니다.';
    } else if (question.investment_level_id === null) {
      score += 5;
      reasonType = 'COMMON_LEVEL';
      reason = '공통 학습 문제입니다.';
    }

    if (hasWeakDetail) {
      score += context.mode === 'weakness' ? 70 : 50;
      reasonType = 'WEAK_DETAIL';
      reason = '틀린 문제가 많은 세부 개념과 관련된 문제입니다.';
    } else if (
      question.category_id !== null &&
      context.weakCategoryIds.has(question.category_id)
    ) {
      score += context.mode === 'weakness' ? 50 : 35;
      reasonType = 'WEAK_CATEGORY';
      reason = '틀린 문제가 많은 카테고리와 관련된 문제입니다.';
    } else if (context.weakTopicIds.has(question.topic_id)) {
      score += context.mode === 'weakness' ? 35 : 25;
      reasonType = 'WEAK_TOPIC';
      reason = '틀린 문제가 많은 주제와 관련된 문제입니다.';
    }

    if (
      hasRecentDetail ||
      (question.category_id !== null &&
        context.recentCategoryIds.has(question.category_id)) ||
      context.recentTopicIds.has(question.topic_id)
    ) {
      score += 15;

      if (!['WEAK_DETAIL', 'WEAK_CATEGORY', 'WEAK_TOPIC'].includes(reasonType)) {
        reasonType = 'RECENT_LEARNING';
        reason = '최근 학습한 주제와 이어지는 문제입니다.';
      }
    }

    if (
      hasBookmarkDetail ||
      (question.category_id !== null &&
        context.bookmarkCategoryIds.has(question.category_id))
    ) {
      score += 10;

      if (
        ![
          'WEAK_DETAIL',
          'WEAK_CATEGORY',
          'WEAK_TOPIC',
          'RECENT_LEARNING',
        ].includes(reasonType)
      ) {
        reasonType = 'BOOKMARK_RELATED';
        reason = '북마크한 문제와 관련된 개념의 문제입니다.';
      }
    }

    if (!attempt) {
      score += 20;
    } else if (attempt.is_correct === true) {
      score -= 30;
    } else if (attempt.is_correct === false) {
      score += context.mode === 'review' ? 60 : 0;

      if (context.mode === 'review') {
        reasonType = 'REVIEW';
        reason = '이전에 틀린 문제를 복습하기 위한 추천입니다.';
      }
    }

    if (attempt && this.isRecentAttempt(attempt)) {
      score -= 20;
    }

    return {
      score,
      reason,
      reasonType,
    };
  }

  private toRecommendedQuestionResponse(
    question: QuizQuestion,
    recommendReason: string,
    recommendReasonType: RecommendationReasonType,
    attemptByQuestionId: Map<number, QuizAttempt>,
    bookmarkQuestionIds: Set<number>,
  ) {
    const attempt = attemptByQuestionId.get(question.question_id);

    return {
      questionId: question.question_id,
      questionText: question.question_text,
      questionType: question.question_type,
      topic: question.topicName
        ? {
            topicId: question.topicName.topicId,
            topicName: question.topicName.topicName,
          }
        : null,
      category: question.category
        ? {
            categoryId: question.category.categoryId,
            categoryName: question.category.categoryName,
          }
        : null,
      details: (question.questionDetails ?? [])
        .filter((questionDetail) => questionDetail.detail)
        .map((questionDetail) => ({
          detailId: questionDetail.detail.detailId,
          detailName: questionDetail.detail.detailName,
        })),
      recommendReason,
      recommendReasonType,
      alreadySolved: Boolean(attempt),
      lastSolvedAt: attempt?.solved_at ?? null,
      lastCorrect: attempt?.is_correct ?? null,
      bookmarked: bookmarkQuestionIds.has(question.question_id),
    };
  }

  private countTopics(attempts: QuizAttempt[]) {
    const map = new Map<number, { topicId: number; topicName: string; wrongCount: number }>();

    attempts.forEach((attempt) => {
      const topic = attempt.question?.topicName;

      if (!topic) {
        return;
      }

      const current = map.get(topic.topicId) ?? {
        topicId: topic.topicId,
        topicName: topic.topicName,
        wrongCount: 0,
      };
      current.wrongCount += 1;
      map.set(topic.topicId, current);
    });

    return [...map.values()].sort((a, b) => b.wrongCount - a.wrongCount);
  }

  private countCategories(attempts: QuizAttempt[]) {
    const map = new Map<
      number,
      { categoryId: number; categoryName: string; wrongCount: number }
    >();

    attempts.forEach((attempt) => {
      const category = attempt.question?.category;

      if (!category) {
        return;
      }

      const current = map.get(category.categoryId) ?? {
        categoryId: category.categoryId,
        categoryName: category.categoryName,
        wrongCount: 0,
      };
      current.wrongCount += 1;
      map.set(category.categoryId, current);
    });

    return [...map.values()].sort((a, b) => b.wrongCount - a.wrongCount);
  }

  private countDetailsFromAttempts(attempts: QuizAttempt[]) {
    const map = new Map<
      number,
      { detailId: number; detailName: string; wrongCount: number }
    >();

    attempts.forEach((attempt) => {
      (attempt.question?.questionDetails ?? []).forEach((questionDetail) => {
        const detail = questionDetail.detail;

        if (!detail) {
          return;
        }

        const current = map.get(detail.detailId) ?? {
          detailId: detail.detailId,
          detailName: detail.detailName,
          wrongCount: 0,
        };
        current.wrongCount += 1;
        map.set(detail.detailId, current);
      });
    });

    return [...map.values()].sort((a, b) => b.wrongCount - a.wrongCount);
  }

  private buildAttemptSignals(attempts: QuizAttempt[]) {
    const topicIds = new Set<number>();
    const categoryIds = new Set<number>();
    const detailIds = new Set<number>();

    attempts.forEach((attempt) => {
      if (attempt.question?.topic_id) {
        topicIds.add(attempt.question.topic_id);
      }

      if (attempt.question?.category_id) {
        categoryIds.add(attempt.question.category_id);
      }

      this.getQuestionDetailIds(attempt.question).forEach((detailId) =>
        detailIds.add(detailId),
      );
    });

    return {
      topicIds,
      categoryIds,
      detailIds,
    };
  }

  private buildBookmarkSignals(bookmarks: QuizBookmark[]) {
    const categoryIds = new Set<number>();
    const detailIds = new Set<number>();

    bookmarks.forEach((bookmark) => {
      if (bookmark.question?.category_id) {
        categoryIds.add(bookmark.question.category_id);
      }

      this.getQuestionDetailIds(bookmark.question).forEach((detailId) =>
        detailIds.add(detailId),
      );
    });

    return {
      categoryIds,
      detailIds,
    };
  }

  private getQuestionDetailIds(question?: QuizQuestion) {
    return (question?.questionDetails ?? [])
      .map((questionDetail) => questionDetail.detailId)
      .filter((detailId): detailId is number => Boolean(detailId));
  }

  private isRecentAttempt(attempt: QuizAttempt) {
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    return Date.now() - new Date(attempt.solved_at).getTime() <= sevenDays;
  }

  private isRewardableQuestion(question: QuizQuestion) {
    return (
      question.visibility === QuizVisibility.PUBLIC &&
      question.reviewStatus === QuizReviewStatus.ACTIVE &&
      question.status === 'ACTIVE' &&
      question.sourceType === QuizSourceType.DEFAULT
    );
  }

  private toStrategy(mode: RecommendationMode) {
    if (mode === 'weakness') {
      return 'WEAKNESS_FIRST';
    }

    if (mode === 'level') {
      return 'LEVEL_BASED';
    }

    if (mode === 'review') {
      return 'REVIEW';
    }

    return 'MIXED';
  }

  private async findQuestionEntityById(
    userId: number,
    questionId: number,
  ): Promise<QuizQuestion> {
    const question = await this.questionRepository.findOne({
      where: [
        {
          question_id: questionId,
          status: 'ACTIVE',
          quizPoolType: In([QuizPoolType.GENERAL, QuizPoolType.BOTH]),
          visibility: QuizVisibility.PUBLIC,
          reviewStatus: QuizReviewStatus.ACTIVE,
        },
        {
          question_id: questionId,
          status: 'ACTIVE',
          quizPoolType: In([QuizPoolType.GENERAL, QuizPoolType.BOTH]),
          visibility: QuizVisibility.PRIVATE,
          ownerUserId: userId,
        },
      ],
      relations: ['choices', 'category'],
    });

    if (!question) {
      throw new NotFoundException('문제를 찾을 수 없습니다.');
    }

    return question;
  }
}
