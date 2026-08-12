import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LearningController } from './controllers/learning.controller';
import { AdminLearningController } from './controllers/admin-learning.controller';
import { LearningService } from './services/learning.service';
import { LearningQualityService } from './services/learning-quality.service';

import { QuizQuestion } from './entities/quiz-question.entity';
import { QuizChoice } from './entities/quiz-choice.entity';
import { QuizAttempt } from './entities/quiz-attempt.entity';
import { QuizBookmark } from './entities/quiz-bookmark.entity';
import { QuizCategory } from './entities/quiz-category.entity';
import { QuizCategoryDetail } from './entities/quiz-category-detail.entity';
import { QuizQuestionDetail } from './entities/quiz-question-detail.entity';
import { User } from '../users/entities/user.entity';
import { TopicName } from './entities/topic-name.entity';
import { InvestmentLevel } from './entities/investment-level.entity';
import { TradingModule } from '../trading/trading.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      QuizQuestion,
      QuizChoice,
      QuizAttempt,
      QuizBookmark,
      QuizCategory,
      QuizCategoryDetail,
      QuizQuestionDetail,
      User,
      TopicName,
      InvestmentLevel,
    ]),
    TradingModule,
  ],
  controllers: [LearningController, AdminLearningController],
  providers: [LearningService, LearningQualityService],
  exports: [LearningService],
})
export class LearningModule {}
