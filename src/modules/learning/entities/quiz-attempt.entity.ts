import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';

import { QuizQuestion } from './quiz-question.entity';

@Entity('quiz_attempts')
export class QuizAttempt {
  @PrimaryGeneratedColumn()
  attempt_id: number;

  @Column()
  user_id: number;

  @Column()
  question_id: number;

  @Column({ nullable: true })
  selected_choice_id: number;

  @Column({ nullable: true })
  is_correct: boolean;

  @Column({ default: 0 })
  reward_cash_earned: number;

  @CreateDateColumn()
  solved_at: Date;

  @ManyToOne(() => QuizQuestion)
  @JoinColumn({ name: 'question_id' })
  question: QuizQuestion;
}