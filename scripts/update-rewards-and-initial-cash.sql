START TRANSACTION;

UPDATE quiz_questions
SET reward_cash = CASE investment_level_id
  WHEN 1 THEN 5000
  WHEN 2 THEN 10000
  WHEN 3 THEN 20000
  ELSE reward_cash
END
WHERE investment_level_id IN (1, 2, 3);

INSERT INTO account_cash_histories (
  account_id,
  history_type,
  amount,
  balance_after,
  ref_type,
  ref_id
)
SELECT
  account_id,
  'DEPOSIT',
  30000000 - seed_money,
  cash_balance + (30000000 - seed_money),
  'INITIAL_CASH_ADJUSTMENT',
  NULL
FROM simulation_accounts
WHERE seed_money < 30000000;

UPDATE simulation_accounts
SET
  cash_balance = cash_balance + (30000000 - seed_money),
  total_asset_value = total_asset_value + (30000000 - seed_money),
  seed_money = 30000000
WHERE seed_money < 30000000;

COMMIT;
