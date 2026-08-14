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
import { TopicName } from './topic-name.entity';
import { LearningConceptBlock } from './learning-concept-block.entity';

@Entity('learning_concepts')
@Unique('uk_learning_concepts_code', ['conceptCode'])
@Unique('uk_learning_concepts_slug', ['slug'])
@Index('idx_learning_concepts_level', [
  'investmentLevelId',
  'status',
  'sortOrder',
])
@Index('idx_learning_concepts_topic', ['topicId', 'status', 'sortOrder'])
export class LearningConcept {
  @PrimaryGeneratedColumn({ name: 'concept_id', type: 'bigint' })
  conceptId: number;

  @Column({ name: 'topic_id', type: 'int', nullable: true })
  topicId: number | null;

  @Column({ name: 'investment_level_id', type: 'int' })
  investmentLevelId: number;

  @Column({ name: 'concept_code', type: 'varchar', length: 120 })
  conceptCode: string;

  @Column({ type: 'varchar', length: 160 })
  slug: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({ name: 'learning_objectives', type: 'json', nullable: true })
  learningObjectives: string[] | null;

  @Column({ name: 'prerequisite_text', type: 'text', nullable: true })
  prerequisiteText: string | null;

  @Column({ name: 'estimated_minutes', type: 'int', default: 5 })
  estimatedMinutes: number;

  @Column({ name: 'sort_order', type: 'int', default: 1 })
  sortOrder: number;

  @Column({ name: 'thumbnail_url', type: 'varchar', length: 500, nullable: true })
  thumbnailUrl: string | null;

  @Column({
    type: 'enum',
    enum: ['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED'],
    default: 'DRAFT',
  })
  status: 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => TopicName, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'topic_id' })
  topic: TopicName | null;

  @ManyToOne(() => InvestmentLevel, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'investment_level_id' })
  investmentLevel: InvestmentLevel;

  @OneToMany(() => LearningConceptBlock, (block) => block.concept)
  blocks: LearningConceptBlock[];
}
