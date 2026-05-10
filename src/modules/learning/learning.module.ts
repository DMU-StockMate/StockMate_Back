import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LearningController } from './controller/learning.controller';
import { LearningService } from './service/learning.service';

import { QuizQuestion } from './entity/quiz-question.entity';
import { QuizChoice } from './entity/quiz-choice.entity';
import { QuizAttempt } from './entity/quiz-attempt.entity';
import { QuizBookmark } from './entity/quiz-bookmark.entity';

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