import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { QuizCategory } from './quiz-category.entity';
import { QuizQuestionDetail } from './quiz-question-detail.entity';

@Entity('quiz_category_details')
@Unique('uk_quiz_category_detail_code', ['detailCode'])
@Unique('uk_quiz_category_detail_name', ['categoryId', 'detailName'])
@Index('idx_quiz_category_detail', ['categoryId', 'status', 'sortOrder'])
export class QuizCategoryDetail {
  @PrimaryGeneratedColumn({ name: 'detail_id' })
  detailId: number;

  @Column({ name: 'category_id', type: 'int' })
  categoryId: number;

  @Column({ name: 'detail_code', type: 'varchar', length: 100 })
  detailCode: string;

  @Column({ name: 'detail_name', type: 'varchar', length: 100 })
  detailName: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 1 })
  sortOrder: number;

  @Column({
    type: 'enum',
    enum: ['ACTIVE', 'INACTIVE'],
    default: 'ACTIVE',
  })
  status: 'ACTIVE' | 'INACTIVE';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => QuizCategory, (category) => category.details, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'category_id' })
  category: QuizCategory;

  @OneToMany(() => QuizQuestionDetail, (questionDetail) => questionDetail.detail)
  questionDetails: QuizQuestionDetail[];
}
