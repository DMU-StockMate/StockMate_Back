import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { QuizQuestion } from '../entities/quiz-question.entity';
import { QuizAttempt } from '../entities/quiz-attempt.entity';
import { QuizBookmark } from '../entities/quiz-bookmark.entity';
import { User } from '../../users/entities/user.entity';
import { SubmitAnswerDto } from '../dto/submit-answer.dto';
import { QuestionResponseDto } from '../dto/reponse.dto';

@Injectable()
export class LearningService {
  constructor(
    @InjectRepository(QuizQuestion)
    private readonly questionRepository: Repository<QuizQuestion>,

    @InjectRepository(QuizAttempt)
    private readonly attemptRepository: Repository<QuizAttempt>,

    @InjectRepository(QuizBookmark)
    private readonly bookmarkRepository: Repository<QuizBookmark>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findAllQuestions() {
    return this.questionRepository.find({
      where: {
        status: 'ACTIVE',
      },
      relations: ['choices'],
      order: {
        question_id: 'DESC',
      },
    });
  }

 async findQuestionById(
    questionId: number,
  ): Promise<QuestionResponseDto> {
    const question = await this.findQuestionEntityById(questionId);

    return {
      questionId: question.question_id,
      questionText: question.question_text,
      choices: question.choices.map((choice) => ({
        id: choice.choice_id,
        text: choice.choice_text,
      })),
    };
  }

 async submitAnswer(
  userId: number,
  questionId: number,
  dto: SubmitAnswerDto,
) {
  const question = await this.findQuestionEntityById(questionId);

  const selectedChoice = question.choices.find(
    (choice) => choice.choice_id === dto.selectedChoiceId,
  );

  if (!selectedChoice) {
    throw new BadRequestException(
      '해당 문제에 속하지 않는 선택지입니다.',
    );
  }

  const isCorrect = selectedChoice.is_correct;
  const reward = isCorrect ? question.reward_cash : 0;

  // 같은 사용자가 같은 문제를 이미 푼 경우 기존 기록 삭제
  await this.attemptRepository.delete({
    user_id: userId,
    question_id: questionId,
  });

  const attempt = this.attemptRepository.create({
    user_id: userId,
    question_id: questionId,
    selected_choice_id: dto.selectedChoiceId,
    is_correct: isCorrect,
    reward_cash_earned: reward,
  });

  await this.attemptRepository.save(attempt);

  return {
    message: '정답 제출이 완료되었습니다.',
    questionId,
    selectedChoiceId: dto.selectedChoiceId,
    correct: isCorrect,
    reward,
    explanation: question.explanation,
  };
}

  async getHistories(userId: number) {
    return this.attemptRepository.find({
      where: {
        user_id: userId,
      },
      relations: ['question'],
      order: {
        solved_at: 'DESC',
      },
    });
  }

  async getStatistics(userId: number) {
    const attempts = await this.attemptRepository.find({
      where: {
        user_id: userId,
      },
    });

    const total = attempts.length;
    const correct = attempts.filter(
      (attempt) => attempt.is_correct,
    ).length;
    const wrong = total - correct;

    return {
      total,
      correct,
      wrong,
      accuracy:
        total === 0
          ? 0
          : Number(((correct / total) * 100).toFixed(1)),
    };
  }

  async getWrongNotes(userId: number) {
    return this.attemptRepository.find({
      where: {
        user_id: userId,
        is_correct: false,
      },
      relations: ['question'],
      order: {
        solved_at: 'DESC',
      },
    });
  }

  async getWrongNote(userId: number, questionId: number) {
    const wrongNote = await this.attemptRepository.findOne({
      where: {
        user_id: userId,
        question_id: questionId,
        is_correct: false,
      },
      relations: ['question'],
      order: {
        solved_at: 'DESC',
      },
    });

    if (!wrongNote) {
      throw new NotFoundException(
        '해당 오답 기록을 찾을 수 없습니다.',
      );
    }

    return wrongNote;
  }

  async deleteWrongNote(userId: number, questionId: number) {
    const wrongNotes = await this.attemptRepository.find({
      where: {
        user_id: userId,
        question_id: questionId,
        is_correct: false,
      },
    });

    if (wrongNotes.length === 0) {
      throw new NotFoundException(
        '삭제할 오답 기록을 찾을 수 없습니다.',
      );
    }

    await this.attemptRepository.remove(wrongNotes);

    return {
      message: '오답 기록이 삭제되었습니다.',
      questionId,
    };
  }

  async addBookmark(userId: number, questionId: number) {
    await this.findQuestionById(questionId);

    const exists = await this.bookmarkRepository.findOne({
      where: {
        user_id: userId,
        question_id: questionId,
      },
    });

    if (exists) {
      throw new ConflictException('이미 북마크한 문제입니다.');
    }

    const bookmark = this.bookmarkRepository.create({
      user_id: userId,
      question_id: questionId,
    });

    await this.bookmarkRepository.save(bookmark);

    return {
      message: '북마크가 추가되었습니다.',
      questionId,
    };
  }

  async getBookmarks(userId: number) {
    return this.bookmarkRepository.find({
      where: {
        user_id: userId,
      },
      relations: ['question'],
      order: {
        created_at: 'DESC',
      },
    });
  }

  async deleteBookmark(userId: number, questionId: number) {
    const bookmark = await this.bookmarkRepository.findOne({
      where: {
        user_id: userId,
        question_id: questionId,
      },
    });

    if (!bookmark) {
      throw new NotFoundException(
        '삭제할 북마크를 찾을 수 없습니다.',
      );
    }

    await this.bookmarkRepository.remove(bookmark);

    return {
      message: '북마크가 삭제되었습니다.',
      questionId,
    };
  }
  private async findQuestionEntityById(
    questionId: number,
  ): Promise<QuizQuestion> {
    const question = await this.questionRepository.findOne({
      where: {
        question_id: questionId,
        status: 'ACTIVE',
      },
      relations: ['choices'],
    });

    if (!question) {
      throw new NotFoundException('문제를 찾을 수 없습니다.');
    }

    return question;
  }
}