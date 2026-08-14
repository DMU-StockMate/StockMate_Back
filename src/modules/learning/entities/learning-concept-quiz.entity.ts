import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne } from 'typeorm';

import { LearningConcept } from './learning-concept.entity';
import { QuizQuestion } from './quiz-question.entity';

@Entity('learning_concept_quizzes')
export class LearningConceptQuiz {
  @Column({ name: 'concept_id', type: 'bigint', primary: true })
  conceptId: number;

  @Column({ name: 'question_id', type: 'int', primary: true })
  questionId: number;

  @Column({ name: 'is_required', type: 'boolean', default: true })
  isRequired: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => LearningConcept, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'concept_id' })
  concept: LearningConcept;

  @ManyToOne(() => QuizQuestion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'question_id' })
  question: QuizQuestion;
}
