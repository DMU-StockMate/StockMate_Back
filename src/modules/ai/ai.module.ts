import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AiChatController } from './controllers/ai-chat.controller';
import { AiChatService } from './services/ai-chat.service';
import { AiLlamaProviderService } from './services/ai-provider.service';

import { AiChatSession } from './entities/ai-chat-session.entity';
import { AiChatMessage } from './entities/ai-chat-message.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { QuizAttempt } from 'src/modules/learning/entities/quiz-attempt.entity';
import { QuizQuestion } from 'src/modules/learning/entities/quiz-question.entity';
import { TopicName } from 'src/modules/learning/entities/topic-name.entity';
import { InvestmentLevel } from 'src/modules/learning/entities/investment-level.entity';
import { QuizChoice } from 'src/modules/learning/entities/quiz-choice.entity';
import { QuizCategory } from 'src/modules/learning/entities/quiz-category.entity';
import { QuizCategoryDetail } from 'src/modules/learning/entities/quiz-category-detail.entity';
import { QuizQuestionDetail } from 'src/modules/learning/entities/quiz-question-detail.entity';
import { AiQuestionService } from './services/ai-question.service';
import { AiQuestionController } from './controllers/ai-question.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AiChatSession,
      AiChatMessage,
      User,
      QuizAttempt,
      QuizQuestion,
      QuizChoice,
      TopicName,
      InvestmentLevel,
      QuizCategory,
      QuizCategoryDetail,
      QuizQuestionDetail,
    ]),
  ],
  controllers: [AiChatController,AiQuestionController],
  providers: [AiChatService, AiLlamaProviderService, AiQuestionService],
  exports: [AiChatService],
})
export class AiModule {}
