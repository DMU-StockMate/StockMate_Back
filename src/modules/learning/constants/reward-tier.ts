// investment_levels: 1=초급, 2=중급, 3=고급, 4=입문 (db/stockmate_full_with_community_utf8_bom.sql 시드 기준)
export const REWARD_CASH_BY_LEVEL: Record<number, number> = {
  4: 500,
  1: 5000,
  2: 10000,
  3: 20000,
};

export const DEFAULT_REWARD_CASH = 5000;

export function getRewardCashForLevel(levelId?: number | null): number {
  if (!levelId) return DEFAULT_REWARD_CASH;
  return REWARD_CASH_BY_LEVEL[levelId] ?? DEFAULT_REWARD_CASH;
}
