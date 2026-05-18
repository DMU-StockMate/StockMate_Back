import {
  Entity,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';

import { QuizQuestion } from './quiz-question.entity';

@Entity('quiz_bookmarks')
export class QuizBookmark {
  @PrimaryColumn()
  user_id: number;

  @PrimaryColumn()
  question_id: number;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => QuizQuestion)
  @JoinColumn({ name: 'question_id' })
  question: QuizQuestion;
}