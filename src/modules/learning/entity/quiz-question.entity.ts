import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
} from 'typeorm';
import { QuizChoice } from './quiz-choice.entity';

@Entity('quiz_questions')
export class QuizQuestion {
  @PrimaryGeneratedColumn()
  question_id: number;

  @Column()
  topic_id: number;

  @Column({ nullable: true })
  investment_level_id: number;

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

  @OneToMany(() => QuizChoice, choice => choice.question)
  choices: QuizChoice[];
}