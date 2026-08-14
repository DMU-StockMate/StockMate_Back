import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { LearningConcept } from './learning-concept.entity';

export type LearningConceptBlockType =
  | 'INTRO'
  | 'HEADING'
  | 'PARAGRAPH'
  | 'IMAGE'
  | 'INFOGRAPHIC'
  | 'CHART'
  | 'TABLE'
  | 'FORMULA'
  | 'EXAMPLE'
  | 'CASE_STUDY'
  | 'KEY_POINT'
  | 'WARNING'
  | 'TIP'
  | 'QUOTE'
  | 'SUMMARY';

@Entity('learning_concept_blocks')
@Unique('uk_learning_concept_blocks_order', ['conceptId', 'sortOrder'])
@Index('idx_learning_concept_blocks_concept', [
  'conceptId',
  'isVisible',
  'sortOrder',
])
export class LearningConceptBlock {
  @PrimaryGeneratedColumn({ name: 'block_id', type: 'bigint' })
  blockId: number;

  @Column({ name: 'concept_id', type: 'bigint' })
  conceptId: number;

  @Column({
    name: 'block_type',
    type: 'enum',
    enum: [
      'INTRO',
      'HEADING',
      'PARAGRAPH',
      'IMAGE',
      'INFOGRAPHIC',
      'CHART',
      'TABLE',
      'FORMULA',
      'EXAMPLE',
      'CASE_STUDY',
      'KEY_POINT',
      'WARNING',
      'TIP',
      'QUOTE',
      'SUMMARY',
    ],
  })
  blockType: LearningConceptBlockType;

  @Column({ name: 'sort_order', type: 'int' })
  sortOrder: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title: string | null;

  @Column({ name: 'content_text', type: 'longtext', nullable: true })
  contentText: string | null;

  @Column({ name: 'content_json', type: 'json', nullable: true })
  contentJson: Record<string, unknown> | null;

  @Column({ name: 'style_variant', type: 'varchar', length: 50, nullable: true })
  styleVariant: string | null;

  @Column({ name: 'is_visible', type: 'boolean', default: true })
  isVisible: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => LearningConcept, (concept) => concept.blocks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'concept_id' })
  concept: LearningConcept;
}
