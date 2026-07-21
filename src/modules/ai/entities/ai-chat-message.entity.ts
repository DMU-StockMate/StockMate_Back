import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { AiChatSession } from './ai-chat-session.entity';

@Entity('ai_chat_messages')
export class AiChatMessage {
  @PrimaryGeneratedColumn({ name: 'message_id' })
  message_id: number;

  @ManyToOne(() => AiChatSession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: AiChatSession;

  @Column({
    type: 'enum',
    enum: ['USER', 'AI'],
  })
  sender_type: 'USER' | 'AI';

  @Column({ type: 'text' })
  message_text: string;

  @CreateDateColumn()
  created_at: Date;
}