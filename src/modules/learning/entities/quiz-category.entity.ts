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

import { InvestmentLevel } from './investment-level.entity';
import { QuizCategoryDetail } from './quiz-category-detail.entity';

@Entity('quiz_categories')
@Unique('uk_quiz_category_code', ['categoryCode'])
@Unique('uk_quiz_category_level_name', ['investmentLevelId', 'categoryName'])
@Index('idx_quiz_category_level', [
  'investmentLevelId',
  'status',
  'sortOrder',
])
export class QuizCategory {
  @PrimaryGeneratedColumn({ name: 'category_id' })
  categoryId: number;

  @Column({ name: 'investment_level_id', type: 'int' })
  investmentLevelId: number;

  @Column({ name: 'category_code', type: 'varchar', length: 100 })
  categoryCode: string;

  @Column({ name: 'category_name', type: 'varchar', length: 100 })
  categoryName: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'problem_direction', type: 'text', nullable: true })
  problemDirection: string | null;

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

  @ManyToOne(() => InvestmentLevel, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'investment_level_id' })
  investmentLevel: InvestmentLevel;

  @OneToMany(() => QuizCategoryDetail, (detail) => detail.category)
  details: QuizCategoryDetail[];
}
