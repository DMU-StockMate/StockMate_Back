import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { QuizQuestion } from './quiz-question.entity';

@Entity('quiz_choices')
export class QuizChoice {
  @PrimaryGeneratedColumn()
  choice_id: number;

  @Column()
  question_id: number;

  @Column()
  choice_no: number;

  @Column('text')
  choice_text: string;

  @Column({ default: false })
  is_correct: boolean;

  @ManyToOne(() => QuizQuestion, (question) => question.choices)
  @JoinColumn({ name: 'question_id' })
  question: QuizQuestion;
}