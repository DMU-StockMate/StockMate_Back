import { RiskType } from 'src/modules/enums/risk-type.enum';

export type ProfileQuestionCategory = 'RISK' | 'KNOWLEDGE';

export interface ProfileOptionScore {
  optionCode: string;
  points: number;
}

export interface ProfileQuestionScoring {
  questionCode: string;
  category: ProfileQuestionCategory;
  options: ProfileOptionScore[];
}

export type RecommendedLevelSlug = 'beginner' | 'intermediate' | 'advanced';

export interface RecommendedLevel {
  levelId: number;
  levelSlug: RecommendedLevelSlug;
}

export const CURRENT_PROFILE_VERSION = 'v1';

// 투자성향(RISK) 6문항 + 지식 수준(KNOWLEDGE) 4문항.
// 선택지 순서는 보수적 -> 공격적 순으로 배치해 points를 인덱스와 일치시켰다.
// 정답이 있는 지식 문항은 정답 옵션에만 만점(3점)을 부여한다.
export const PROFILE_QUESTION_SCORING: ProfileQuestionScoring[] = [
  {
    questionCode: 'INVESTMENT_GOAL',
    category: 'RISK',
    options: [
      { optionCode: 'PRINCIPAL_PROTECTION', points: 0 },
      { optionCode: 'STABLE_INCOME', points: 1 },
      { optionCode: 'BALANCED_GROWTH', points: 2 },
      { optionCode: 'HIGH_RETURN', points: 3 },
    ],
  },
  {
    questionCode: 'INVESTMENT_HORIZON',
    category: 'RISK',
    options: [
      { optionCode: 'UNDER_6_MONTHS', points: 0 },
      { optionCode: 'SIX_MONTHS_TO_1_YEAR', points: 1 },
      { optionCode: 'ONE_TO_3_YEARS', points: 2 },
      { optionCode: 'OVER_3_YEARS', points: 3 },
    ],
  },
  {
    questionCode: 'INVESTMENT_RATIO',
    category: 'RISK',
    options: [
      { optionCode: 'UNDER_10_PERCENT', points: 0 },
      { optionCode: 'TEN_TO_30_PERCENT', points: 1 },
      { optionCode: 'THIRTY_TO_50_PERCENT', points: 2 },
      { optionCode: 'OVER_50_PERCENT', points: 3 },
    ],
  },
  {
    questionCode: 'LOSS_TOLERANCE',
    category: 'RISK',
    options: [
      { optionCode: 'LOSS_10_PERCENT', points: 0 },
      { optionCode: 'LOSS_20_PERCENT', points: 1 },
      { optionCode: 'LOSS_30_PERCENT', points: 2 },
      { optionCode: 'LOSS_50_PERCENT_OR_MORE', points: 3 },
    ],
  },
  {
    questionCode: 'LOSS_REACTION',
    category: 'RISK',
    options: [
      { optionCode: 'SELL_IMMEDIATELY', points: 0 },
      { optionCode: 'HOLD_AND_WAIT', points: 1 },
      { optionCode: 'BUY_MORE_AT_LOWER_PRICE', points: 2 },
      { optionCode: 'INVEST_MORE_AGGRESSIVELY', points: 3 },
    ],
  },
  {
    questionCode: 'RISK_RETURN_PREFERENCE',
    category: 'RISK',
    options: [
      { optionCode: 'SAFE_LOW_RETURN', points: 0 },
      { optionCode: 'MODERATE_RISK_MODERATE_RETURN', points: 1 },
      { optionCode: 'HIGH_RISK_HIGH_RETURN', points: 2 },
      { optionCode: 'VERY_HIGH_RISK_VERY_HIGH_RETURN', points: 3 },
    ],
  },
  {
    questionCode: 'INVESTMENT_EXPERIENCE',
    category: 'KNOWLEDGE',
    options: [
      { optionCode: 'NONE', points: 0 },
      { optionCode: 'UNDER_1_YEAR', points: 1 },
      { optionCode: 'ONE_TO_3_YEARS', points: 2 },
      { optionCode: 'OVER_3_YEARS', points: 3 },
    ],
  },
  {
    questionCode: 'TRADED_PRODUCTS',
    category: 'KNOWLEDGE',
    options: [
      { optionCode: 'NONE', points: 0 },
      { optionCode: 'DOMESTIC_STOCKS_ONLY', points: 1 },
      { optionCode: 'STOCKS_AND_ETF', points: 2 },
      { optionCode: 'STOCKS_ETF_AND_DERIVATIVES', points: 3 },
    ],
  },
  {
    questionCode: 'BASIC_CONCEPT_QUIZ',
    category: 'KNOWLEDGE',
    options: [
      { optionCode: 'PER_CORRECT', points: 3 },
      { optionCode: 'PER_WRONG_1', points: 0 },
      { optionCode: 'PER_WRONG_2', points: 0 },
      { optionCode: 'PER_WRONG_3', points: 0 },
    ],
  },
  {
    questionCode: 'ORDER_PROFIT_LOSS_QUIZ',
    category: 'KNOWLEDGE',
    options: [
      { optionCode: 'STOPLOSS_CORRECT', points: 3 },
      { optionCode: 'STOPLOSS_WRONG_1', points: 0 },
      { optionCode: 'STOPLOSS_WRONG_2', points: 0 },
      { optionCode: 'STOPLOSS_WRONG_3', points: 0 },
    ],
  },
];

interface ScoreThreshold<T> {
  maxScore: number;
  value: T;
}

const RISK_TYPE_THRESHOLDS: ScoreThreshold<RiskType>[] = [
  { maxScore: 20, value: RiskType.CONSERVATIVE },
  { maxScore: 40, value: RiskType.MODERATE_CONSERVATIVE },
  { maxScore: 60, value: RiskType.BALANCED },
  { maxScore: 80, value: RiskType.AGGRESSIVE },
  { maxScore: 100, value: RiskType.VERY_AGGRESSIVE },
];

const LEVEL_THRESHOLDS: ScoreThreshold<RecommendedLevel>[] = [
  { maxScore: 40, value: { levelId: 1, levelSlug: 'beginner' } },
  { maxScore: 75, value: { levelId: 2, levelSlug: 'intermediate' } },
  { maxScore: 100, value: { levelId: 3, levelSlug: 'advanced' } },
];

function resolveThreshold<T>(
  score: number,
  thresholds: ScoreThreshold<T>[],
): T {
  const matched = thresholds.find((t) => score <= t.maxScore);
  return (matched ?? thresholds[thresholds.length - 1]).value;
}

export function resolveRiskType(score: number): RiskType {
  return resolveThreshold(score, RISK_TYPE_THRESHOLDS);
}

export function resolveRecommendedLevel(score: number): RecommendedLevel {
  return resolveThreshold(score, LEVEL_THRESHOLDS);
}

export function normalizeScore(raw: number, min: number, max: number): number {
  if (max === min) return 0;
  return Math.round(((raw - min) / (max - min)) * 100);
}

export function getCategoryRange(category: ProfileQuestionCategory) {
  const questions = PROFILE_QUESTION_SCORING.filter(
    (q) => q.category === category,
  );
  const min = questions.reduce(
    (sum, q) => sum + Math.min(...q.options.map((o) => o.points)),
    0,
  );
  const max = questions.reduce(
    (sum, q) => sum + Math.max(...q.options.map((o) => o.points)),
    0,
  );
  return { min, max };
}

export function recommendedLevelSlugById(
  levelId: number,
): RecommendedLevelSlug {
  return (
    LEVEL_THRESHOLDS.find((t) => t.value.levelId === levelId)?.value
      .levelSlug ?? 'beginner'
  );
}
