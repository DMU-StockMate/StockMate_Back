import { LearningService } from './learning.service';
import {
  QuizPoolType,
  QuizQuestionSource,
  QuizReviewStatus,
  QuizSourceType,
  QuizVisibility,
} from '../entities/quiz-question.entity';

const makeService = () => {
  const questionRepository = {
    findOne: jest.fn(),
  };
  const attemptRepository = {
    findOne: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ attempt_id: 10, ...value })),
  };
  const tradingService = {
    creditReward: jest.fn(),
  };

  return {
    service: new LearningService(
      questionRepository as any,
      attemptRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      tradingService as any,
    ),
    questionRepository,
    attemptRepository,
    tradingService,
  };
};

const makeQuestion = (overrides: Record<string, unknown> = {}) => ({
  question_id: 1058,
  status: 'ACTIVE',
  quizPoolType: QuizPoolType.GENERAL,
  visibility: QuizVisibility.PUBLIC,
  reviewStatus: QuizReviewStatus.ACTIVE,
  sourceType: QuizSourceType.DEFAULT,
  source: QuizQuestionSource.MANUAL,
  reward_cash: 1000,
  explanation: 'explanation',
  choices: [
    { choice_id: 1, is_correct: true },
    { choice_id: 2, is_correct: false },
  ],
  ...overrides,
});

describe('LearningService reward policy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('credits official public questions once using a stable quiz question reference', async () => {
    const { service, questionRepository, attemptRepository, tradingService } =
      makeService();
    questionRepository.findOne.mockResolvedValue(makeQuestion());
    attemptRepository.findOne.mockResolvedValue(null);
    tradingService.creditReward.mockResolvedValue({
      credited: true,
      amount: 1000,
    });

    await expect(
      service.submitAnswer(7, 1058, { selectedChoiceId: 1 }),
    ).resolves.toEqual(
      expect.objectContaining({
        correct: true,
        reward: 1000,
      }),
    );

    expect(tradingService.creditReward).toHaveBeenCalledWith(
      7,
      1000,
      1058,
      'QUIZ_QUESTION',
    );
    expect(attemptRepository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reward_cash_earned: 1000,
      }),
    );
  });

  it('does not credit private AI personal questions even if answered correctly', async () => {
    const { service, questionRepository, attemptRepository, tradingService } =
      makeService();
    questionRepository.findOne.mockResolvedValue(
      makeQuestion({
        visibility: QuizVisibility.PRIVATE,
        ownerUserId: 7,
        sourceType: QuizSourceType.PERSONAL_PROMPT,
        source: QuizQuestionSource.AI,
        reward_cash: 1000,
      }),
    );
    attemptRepository.findOne.mockResolvedValue(null);

    await expect(
      service.submitAnswer(7, 1058, { selectedChoiceId: 1 }),
    ).resolves.toEqual(
      expect.objectContaining({
        correct: true,
        reward: 0,
      }),
    );

    expect(tradingService.creditReward).not.toHaveBeenCalled();
  });
});
