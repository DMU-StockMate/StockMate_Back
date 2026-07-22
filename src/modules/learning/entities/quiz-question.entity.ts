import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  JoinColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { QuizChoice } from './quiz-choice.entity';
import { TopicName } from './topic-name.entity';
import { InvestmentLevel } from './investment-level.entity';
import { QuizCategory } from './quiz-category.entity';
import { QuizQuestionDetail } from './quiz-question-detail.entity';

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

  @OneToMany(() => QuizChoice, choice => choice.question)
  choices: QuizChoice[];

  @OneToMany(
    () => QuizQuestionDetail,
    (questionDetail) => questionDetail.question,
  )
  questionDetails: QuizQuestionDetail[];
}
