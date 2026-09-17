import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

export enum TutorialType {
  INVESTMENT_LEARNING = 'INVESTMENT_LEARNING',
  PERSONALIZED_LEARNING = 'PERSONALIZED_LEARNING',
  CONCEPT_SUMMARY = 'CONCEPT_SUMMARY',
  QUIZ = 'QUIZ',
  LEARNING_PROGRESS = 'LEARNING_PROGRESS',
}

@Entity('user_tutorials')
@Unique('uk_user_tutorials_user_type', ['userId', 'tutorialType'])
@Index('idx_user_tutorials_user', ['userId'])
export class UserTutorial {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true, name: 'id' })
  id: number;

  @Column({ type: 'bigint', unsigned: true, name: 'user_id' })
  userId: number;

  @Column({
    type: 'enum',
    enum: TutorialType,
    name: 'tutorial_type',
  })
  tutorialType: TutorialType;

  @Column({ type: 'boolean', default: false })
  completed: boolean;

  @Column({ type: 'datetime', name: 'completed_at', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;
}
