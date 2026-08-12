import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { InvestmentLevel } from './investment-level.entity';
import { QuizCategory } from './quiz-category.entity';
import { QuizChoice } from './quiz-choice.entity';
import { QuizQuestionDetail } from './quiz-question-detail.entity';
import { TopicName } from './topic-name.entity';
import { User } from '../../users/entities/user.entity';

export enum QuizSourceType {
  DEFAULT = 'DEFAULT',
  WRONG_ANSWER = 'WRONG_ANSWER',
  PERSONAL_PROMPT = 'PERSONAL_PROMPT',
  ADMIN = 'ADMIN',
}

export enum QuizVisibility {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
}

export enum QuizQuestionSource {
  MANUAL = 'MANUAL',
  AI = 'AI',
}

export enum QuizReviewStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  REJECTED = 'REJECTED',
  REVIEW_REQUIRED = 'REVIEW_REQUIRED',
}

@Entity('quiz_questions')
export class QuizQuestion {
  @PrimaryGeneratedColumn()
  question_id: number;

  @Column({
    type: 'int',
    name: 'topic_id',
  })
  topic_id: number;

  @ManyToOne(() => TopicName, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'topic_id' })
  topicName: TopicName;

  @Column({
    type: 'int',
    name: 'investment_level_id',
    nullable: true,
  })
  investment_level_id: number | null;

  @ManyToOne(() => InvestmentLevel, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'investment_level_id' })
  investmentLevel: InvestmentLevel | null;

  @Column({
    type: 'int',
    name: 'category_id',
    nullable: true,
  })
  category_id: number | null;

  @ManyToOne(() => QuizCategory, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'category_id' })
  category: QuizCategory | null;

  @Column({ name: 'owner_user_id', type: 'int', nullable: true })
  ownerUserId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_user_id' })
  ownerUser: User | null;

  @Column({
    name: 'source_type',
    type: 'enum',
    enum: QuizSourceType,
    default: QuizSourceType.DEFAULT,
  })
  sourceType: QuizSourceType;

  @Column({
    type: 'enum',
    enum: QuizVisibility,
    default: QuizVisibility.PUBLIC,
  })
  visibility: QuizVisibility;

  @Column({ name: 'source_question_id', type: 'int', nullable: true })
  sourceQuestionId: number | null;

  @ManyToOne(() => QuizQuestion, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'source_question_id' })
  sourceQuestion: QuizQuestion | null;

  @Column({
    type: 'enum',
    enum: QuizQuestionSource,
    default: QuizQuestionSource.MANUAL,
  })
  source: QuizQuestionSource;

  @Column({
    name: 'review_status',
    type: 'enum',
    enum: QuizReviewStatus,
    default: QuizReviewStatus.ACTIVE,
  })
  reviewStatus: QuizReviewStatus;

  @Column({ name: 'ai_quality_score', type: 'int', nullable: true })
  aiQualityScore: number | null;

  @Column({ name: 'final_quality_score', type: 'int', nullable: true })
  finalQualityScore: number | null;

  @Column({
    name: 'similarity_score',
    type: 'decimal',
    precision: 5,
    scale: 4,
    nullable: true,
  })
  similarityScore: number | string | null;

  @Column({ name: 'similar_question_id', type: 'int', nullable: true })
  similarQuestionId: number | null;

  @Column({ name: 'reviewed_at', type: 'datetime', nullable: true })
  reviewedAt: Date | null;

  @Column()
  question_type: string;

  @Column('text')
  question_text: string;

  @Column('text', { nullable: true })
  explanation: string;

  @Column()
  reward_cash: number;

  @Column()
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => QuizChoice, (choice) => choice.question)
  choices: QuizChoice[];

  @OneToMany(
    () => QuizQuestionDetail,
    (questionDetail) => questionDetail.question,
  )
  questionDetails: QuizQuestionDetail[];
}
