import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';
import { QuizQuestion } from '../../learning/entities/quiz-question.entity';
import { AiChatMessage } from './ai-chat-message.entity';

@Entity('ai_chat_sessions')
export class AiChatSession {
  @PrimaryGeneratedColumn({ name: 'session_id' })
  session_id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => QuizQuestion, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'question_id' })
  question: QuizQuestion | null;

  @Column({
    type: 'enum',
    enum: ['ANALYSIS', 'FEEDBACK', 'GENERAL'],
    default: 'GENERAL',
  })
  session_type: 'ANALYSIS' | 'FEEDBACK' | 'GENERAL';

  @Column({ type: 'varchar', length: 255, nullable: true })
  title: string | null;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => AiChatMessage, (message) => message.session)
  messages: AiChatMessage[];
}