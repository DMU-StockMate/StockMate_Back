import { IsEnum } from 'class-validator';

import { QuizReviewStatus } from '../entities/quiz-question.entity';

export class UpdateQuestionReviewStatusDto {
  @IsEnum(QuizReviewStatus)
  reviewStatus: QuizReviewStatus;
}
