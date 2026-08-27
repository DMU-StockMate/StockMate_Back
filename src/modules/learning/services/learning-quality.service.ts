import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { QualityCandidatesQueryDto } from '../dto/quality-candidates-query.dto';
import { UpdateQuestionReviewStatusDto } from '../dto/update-question-review-status.dto';
import { QuizAttempt } from '../entities/quiz-attempt.entity';
import { QuizCategoryDetail } from '../entities/quiz-category-detail.entity';
import {
  QuizPoolType,
  QuizQuestion,
  QuizReviewStatus,
} from '../entities/quiz-question.entity';

const TARGET_ACTIVE_COUNT = 50;

@Injectable()
export class LearningQualityService {
  constructor(
    @InjectRepository(QuizQuestion)
    private readonly questionRepository: Repository<QuizQuestion>,

    @InjectRepository(QuizAttempt)
    private readonly attemptRepository: Repository<QuizAttempt>,

    @InjectRepository(QuizCategoryDetail)
    private readonly detailRepository: Repository<QuizCategoryDetail>,
  ) {}

  async getQualitySummary() {
    const questions = await this.findQuestions();
    const reviewStatusCounts = Object.values(QuizReviewStatus).reduce(
      (counts, status) => ({ ...counts, [status]: 0 }),
      {} as Record<QuizReviewStatus, number>,
    );
    const detailCounts = new Map<number, ActiveCountItem>();

    questions.forEach((question) => {
      reviewStatusCounts[question.reviewStatus] += 1;

      if (!this.isGeneralPoolQuestion(question) || !this.isActiveQuestion(question)) {
        return;
      }

      (question.questionDetails ?? []).forEach((questionDetail) => {
        if (!questionDetail.detail) {
          return;
        }

        const current = detailCounts.get(questionDetail.detailId) ?? {
          detailId: questionDetail.detailId,
          detailName: questionDetail.detail.detailName,
          categoryId: questionDetail.detail.categoryId,
          categoryName: question.category?.categoryName ?? null,
          activeCount: 0,
        };
        current.activeCount += 1;
        detailCounts.set(questionDetail.detailId, current);
      });
    });

    const detailActiveCounts = [...detailCounts.values()];

    return {
      totalQuestions: questions.length,
      targetActiveCount: TARGET_ACTIVE_COUNT,
      reviewStatusCounts,
      detailActiveCounts,
      underTargetDetails: detailActiveCounts.filter(
        (detail) => detail.activeCount < TARGET_ACTIVE_COUNT,
      ),
      overTargetDetails: detailActiveCounts.filter(
        (detail) => detail.activeCount > TARGET_ACTIVE_COUNT,
      ),
    };
  }

  async getQualityCandidates(query: QualityCandidatesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filtered = (await this.findQuestions()).filter((question) =>
      this.matchesQuery(question, query),
    );
    const items = filtered.slice((page - 1) * limit, page * limit);

    return {
      items: items.map((question) => this.toCandidate(question)),
      meta: {
        page,
        limit,
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / limit),
      },
    };
  }

  async getReplacementCandidates(detailId: number) {
    const detail = await this.detailRepository.findOne({
      where: { detailId },
      relations: ['category'],
    });

    if (!detail) {
      throw new NotFoundException('세부 개념을 찾을 수 없습니다.');
    }

    const questions = (await this.findQuestions()).filter(
      (question) =>
        this.isGeneralPoolQuestion(question) && this.hasDetail(question, detailId),
    );
    const activeQuestions = questions.filter((question) =>
      this.isActiveQuestion(question),
    );

    return {
      detailId: detail.detailId,
      detailName: detail.detailName,
      targetActiveCount: TARGET_ACTIVE_COUNT,
      activeCount: activeQuestions.length,
      pendingCount: questions.filter(
        (question) => question.reviewStatus === QuizReviewStatus.PENDING,
      ).length,
      reviewRequiredCount: questions.filter(
        (question) =>
          question.reviewStatus === QuizReviewStatus.REVIEW_REQUIRED,
      ).length,
      recommendedPromotions: questions
        .filter((question) => this.isPromotionCandidate(question))
        .sort((a, b) => this.qualityScoreOf(b) - this.qualityScoreOf(a))
        .map((question) => this.toCandidate(question)),
      recommendedDemotions: await this.getDemotionCandidates(activeQuestions),
    };
  }

  async updateReviewStatus(
    questionId: number,
    dto: UpdateQuestionReviewStatusDto,
  ) {
    const question = await this.findQuestion(questionId);
    const warnings =
      dto.reviewStatus === QuizReviewStatus.ACTIVE
        ? await this.getActiveOverflowWarnings(question)
        : [];

    question.reviewStatus = dto.reviewStatus;
    question.status =
      dto.reviewStatus === QuizReviewStatus.ACTIVE ? 'ACTIVE' : 'INACTIVE';
    question.reviewedAt = new Date();

    const savedQuestion = await this.questionRepository.save(question);

    return {
      ...this.toCandidate(savedQuestion),
      warning: warnings.length > 0 ? warnings.join(' ') : null,
    };
  }

  async recalculateQuality(questionId: number) {
    const question = await this.findQuestion(questionId);
    const accuracyRate = await this.getAccuracyRate(question.question_id);

    question.finalQualityScore = this.calculateFinalQualityScore({
      aiQualityScore: question.aiQualityScore,
      similarityScore: this.toNumberOrNull(question.similarityScore),
      accuracyRate,
    });

    const savedQuestion = await this.questionRepository.save(question);

    return {
      ...this.toCandidate(savedQuestion, accuracyRate),
      accuracyRate,
    };
  }

  private findQuestions() {
    return this.questionRepository.find({
      relations: [
        'category',
        'questionDetails',
        'questionDetails.detail',
        'topicName',
      ],
      order: {
        finalQualityScore: 'ASC',
        question_id: 'DESC',
      },
    });
  }

  private async findQuestion(questionId: number) {
    const question = await this.questionRepository.findOne({
      where: { question_id: questionId },
      relations: [
        'category',
        'questionDetails',
        'questionDetails.detail',
        'topicName',
      ],
    });

    if (!question) {
      throw new NotFoundException('문제를 찾을 수 없습니다.');
    }

    return question;
  }

  private matchesQuery(
    question: QuizQuestion,
    query: QualityCandidatesQueryDto,
  ) {
    if (query.detailId && !this.hasDetail(question, query.detailId)) {
      return false;
    }

    if (query.categoryId && question.category_id !== query.categoryId) {
      return false;
    }

    if (query.reviewStatus && question.reviewStatus !== query.reviewStatus) {
      return false;
    }

    const similarityScore = this.toNumberOrNull(question.similarityScore);
    if (
      query.minSimilarity !== undefined &&
      (similarityScore === null || similarityScore < query.minSimilarity)
    ) {
      return false;
    }

    if (
      query.maxFinalQualityScore !== undefined &&
      (question.finalQualityScore === null ||
        question.finalQualityScore > query.maxFinalQualityScore)
    ) {
      return false;
    }

    return true;
  }

  private async getDemotionCandidates(questions: QuizQuestion[]) {
    const candidates = await Promise.all(
      questions.map(async (question) => {
        const accuracyRate = await this.getAccuracyRate(question.question_id);
        const accuracyOutlier =
          accuracyRate !== null && (accuracyRate >= 0.95 || accuracyRate <= 0.2);

        if (this.qualityScoreOf(question) >= 70 && !accuracyOutlier) {
          return null;
        }

        return this.toCandidate(question, accuracyRate);
      }),
    );

    return candidates.filter((candidate) => candidate !== null);
  }

  private async getActiveOverflowWarnings(question: QuizQuestion) {
    const questions = await this.findQuestions();

    return (question.questionDetails ?? [])
      .filter((questionDetail) => {
        const activeCount = questions.filter(
          (candidate) =>
            candidate.question_id !== question.question_id &&
            this.isGeneralPoolQuestion(candidate) &&
            this.isActiveQuestion(candidate) &&
            this.hasDetail(candidate, questionDetail.detailId),
        ).length;

        return activeCount + 1 > TARGET_ACTIVE_COUNT;
      })
      .map(
        (questionDetail) =>
          `${questionDetail.detail?.detailName ?? questionDetail.detailId} 세부 개념의 ACTIVE 문제가 ${TARGET_ACTIVE_COUNT}개를 초과할 수 있습니다.`,
      );
  }

  private async getAccuracyRate(questionId: number) {
    const attempts = await this.attemptRepository.find({
      where: { question_id: questionId },
    });

    if (attempts.length === 0) {
      return null;
    }

    return (
      attempts.filter((attempt) => attempt.is_correct === true).length /
      attempts.length
    );
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

  private toCandidate(question: QuizQuestion, accuracyRate: number | null = null) {
    const primaryDetail =
      question.questionDetails?.find((questionDetail) => questionDetail.isPrimary)
        ?.detail ??
      question.questionDetails?.[0]?.detail ??
      null;

    return {
      questionId: question.question_id,
      questionText: question.question_text,
      category: question.category
        ? {
            categoryId: question.category.categoryId,
            categoryName: question.category.categoryName,
          }
        : null,
      detail: primaryDetail
        ? {
            detailId: primaryDetail.detailId,
            detailName: primaryDetail.detailName,
          }
        : null,
      sourceType: question.sourceType,
      quizPoolType: question.quizPoolType,
      visibility: question.visibility,
      source: question.source,
      reviewStatus: question.reviewStatus,
      aiQualityScore: question.aiQualityScore,
      finalQualityScore: question.finalQualityScore,
      similarityScore: this.toNumberOrNull(question.similarityScore),
      similarQuestionId: question.similarQuestionId,
      reason: this.buildReason(question, accuracyRate),
    };
  }

  private buildReason(question: QuizQuestion, accuracyRate: number | null) {
    const similarityScore = this.toNumberOrNull(question.similarityScore);
    const finalQualityScore = this.qualityScoreOf(question);

    if (similarityScore !== null && similarityScore >= 0.9) {
      return '유사도 0.90 이상으로 반려 또는 추가 검수가 필요한 문제입니다.';
    }

    if (similarityScore !== null && similarityScore >= 0.85) {
      return '유사도 0.85 이상으로 검수 후 노출 여부를 판단해야 합니다.';
    }

    if (accuracyRate !== null && (accuracyRate >= 0.95 || accuracyRate <= 0.2)) {
      return '정답률 이상치가 있어 품질 점검이 필요한 문제입니다.';
    }

    if (
      finalQualityScore >= 85 &&
      (similarityScore === null || similarityScore < 0.85)
    ) {
      return '품질 점수가 높고 유사도가 낮아 ACTIVE 승격 후보입니다.';
    }

    if (finalQualityScore >= 70) {
      return '품질 점수가 보통 수준이라 대기 후보로 유지할 수 있습니다.';
    }

    if (finalQualityScore >= 50) {
      return '품질 점수가 낮아 수정 검토가 필요한 문제입니다.';
    }

    return '품질 점수가 매우 낮아 비활성화 후보입니다.';
  }

  private isPromotionCandidate(question: QuizQuestion) {
    const similarityScore = this.toNumberOrNull(question.similarityScore);

    return (
      this.isGeneralPoolQuestion(question) &&
      [
        QuizReviewStatus.PENDING,
        QuizReviewStatus.REVIEW_REQUIRED,
      ].includes(question.reviewStatus) &&
      this.qualityScoreOf(question) >= 85 &&
      (similarityScore === null || similarityScore < 0.85)
    );
  }

  private isActiveQuestion(question: QuizQuestion) {
    return (
      question.status === 'ACTIVE' &&
      question.reviewStatus === QuizReviewStatus.ACTIVE
    );
  }

  private isGeneralPoolQuestion(question: QuizQuestion) {
    return question.quizPoolType === QuizPoolType.GENERAL;
  }

  private hasDetail(question: QuizQuestion, detailId: number) {
    return question.questionDetails?.some(
      (questionDetail) => questionDetail.detailId === detailId,
    );
  }

  private qualityScoreOf(question: QuizQuestion) {
    return question.finalQualityScore ?? question.aiQualityScore ?? 70;
  }

  private toNumberOrNull(value: number | string | null) {
    if (value === null) {
      return null;
    }

    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }
}

export interface ActiveCountItem {
  detailId: number;
  detailName: string;
  categoryId: number;
  categoryName: string | null;
  activeCount: number;
}
