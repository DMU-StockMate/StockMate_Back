import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AiChatController } from '../controllers/ai-chat.controller';
import { AiChatService } from '../services/ai-chat.service';
import { AiLlamaProviderService } from '../services/ai-provide.service';

import { AiChatSession } from '../entities/ai-chat-session.entity';
import { AiChatMessage } from '../entities/ai-chat-message.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { QuizQuestion } from 'src/modules/learning/entities/quiz-question.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AiChatSession,
      AiChatMessage,
      User,
      QuizQuestion,
    ]),
  ],
  controllers: [AiChatController],
  providers: [AiChatService, AiLlamaProviderService],
  exports: [AiChatService],
})
export class AiModule {}