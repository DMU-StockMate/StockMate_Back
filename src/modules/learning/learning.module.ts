import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LearningController } from './controllers/learning.controller';
import { LearningService } from './services/learning.service';

import { QuizQuestion } from './entities/quiz-question.entity';
import { QuizChoice } from './entities/quiz-choice.entity';
import { QuizAttempt } from './entities/quiz-attempt.entity';
import { QuizBookmark } from './entities/quiz-bookmark.entity';
import { User } from '../users/entities/user.entity';
import { TopicName } from './entities/topic-name.entity';
import { InvestmentLevel } from './entities/investment-level.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      QuizQuestion,
      QuizChoice,
      QuizAttempt,
      QuizBookmark,
      User,
      TopicName,
      InvestmentLevel,
    ]),
  ],
  controllers: [LearningController],
  providers: [LearningService],
  exports: [LearningService],
})
export class LearningModule {}
