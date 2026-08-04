-- 기존에 전부 1000원으로 고정되어 있던 reward_cash를 난이도별로 차등 적용한다.
-- 입문(500) < 초급(1000) < 중급(2000) < 고급(3000)
UPDATE quiz_questions
SET reward_cash = 500
WHERE investment_level_id = (SELECT investment_level_id FROM investment_levels WHERE level_name = '입문' LIMIT 1);

UPDATE quiz_questions
SET reward_cash = 1000
WHERE investment_level_id = (SELECT investment_level_id FROM investment_levels WHERE level_name = '초급' LIMIT 1);

UPDATE quiz_questions
SET reward_cash = 2000
WHERE investment_level_id = (SELECT investment_level_id FROM investment_levels WHERE level_name = '중급' LIMIT 1);

UPDATE quiz_questions
SET reward_cash = 3000
WHERE investment_level_id = (SELECT investment_level_id FROM investment_levels WHERE level_name = '고급' LIMIT 1);
