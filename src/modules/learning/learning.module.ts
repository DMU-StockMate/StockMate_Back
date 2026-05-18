import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LearningController } from './controllers/learning.controller';
import { LearningService } from './service/learning.service';

import { QuizQuestion } from './entities/quiz-question.entity';
import { QuizChoice } from './entities/quiz-choice.entity';
import { QuizAttempt } from './entities/quiz-attempt.entity';
import { QuizBookmark } from './entities/quiz-bookmark.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      QuizQuestion,
      QuizChoice,
      QuizAttempt,
      QuizBookmark,
    ]),
  ],
  controllers: [LearningController],
  providers: [LearningService],
  exports: [LearningService],
})
export class LearningModule {}