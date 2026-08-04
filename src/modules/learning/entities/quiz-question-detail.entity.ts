import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { QuizCategoryDetail } from './quiz-category-detail.entity';
import { QuizQuestion } from './quiz-question.entity';

@Entity('quiz_question_details')
export class QuizQuestionDetail {
  @PrimaryColumn({ name: 'question_id', type: 'int' })
  questionId: number;

  @PrimaryColumn({ name: 'detail_id', type: 'int' })
  detailId: number;

  @Column({ name: 'is_primary', default: false })
  isPrimary: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => QuizQuestion, (question) => question.questionDetails, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'question_id' })
  question: QuizQuestion;

  @ManyToOne(() => QuizCategoryDetail, (detail) => detail.questionDetails, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'detail_id' })
  detail: QuizCategoryDetail;
}
