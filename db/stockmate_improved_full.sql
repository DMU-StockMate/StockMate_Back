CREATE DATABASE IF NOT EXISTS stockmate
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE stockmate;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS trade_feedbacks;
DROP TABLE IF EXISTS ranking_entries;
DROP TABLE IF EXISTS ranking_seasons;
DROP TABLE IF EXISTS ai_chat_messages;
DROP TABLE IF EXISTS ai_chat_sessions;
DROP TABLE IF EXISTS portfolio_daily_snapshots;
DROP TABLE IF EXISTS portfolio_holdings;
DROP TABLE IF EXISTS simulated_trades;
DROP TABLE IF EXISTS account_cash_histories;
DROP TABLE IF EXISTS simulation_accounts;
DROP TABLE IF EXISTS quiz_bookmarks;
DROP TABLE IF EXISTS quiz_attempts;
DROP TABLE IF EXISTS quiz_choices;
DROP TABLE IF EXISTS quiz_question_details;
DROP TABLE IF EXISTS quiz_questions;
DROP TABLE IF EXISTS quiz_category_details;
DROP TABLE IF EXISTS quiz_categories;
DROP TABLE IF EXISTS learning_contents;
DROP TABLE IF EXISTS learning_topics;
DROP TABLE IF EXISTS stock_price_daily;
DROP TABLE IF EXISTS stock_details;
DROP TABLE IF EXISTS stocks;
DROP TABLE IF EXISTS images;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS investment_levels;

SET FOREIGN_KEY_CHECKS = 1;

-- =========================================================
-- 1. 투자 수준
-- =========================================================
CREATE TABLE investment_levels (
  investment_level_id INT AUTO_INCREMENT PRIMARY KEY,
  level_name VARCHAR(50) NOT NULL,
  description TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 2. 회원 정보
-- =========================================================
CREATE TABLE users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(50) NOT NULL,
  nickname VARCHAR(50) UNIQUE,
  phone VARCHAR(50),
  role ENUM('USER', 'ADMIN') DEFAULT 'USER',
  status ENUM('ACTIVE', 'INACTIVE', 'BANNED', 'DELETED') DEFAULT 'ACTIVE',
  ban_until DATETIME NULL,
  investment_level_id INT,
  profile_image_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_investment_level
    FOREIGN KEY (investment_level_id)
    REFERENCES investment_levels(investment_level_id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 3. 종목 기본 정보
-- =========================================================
CREATE TABLE stocks (
  stock_id INT AUTO_INCREMENT PRIMARY KEY,
  ticker VARCHAR(20) NOT NULL UNIQUE,
  company_name VARCHAR(100) NOT NULL,
  market VARCHAR(20),
  sector VARCHAR(50),
  currency VARCHAR(10) DEFAULT 'KRW',
  status ENUM('ACTIVE', 'DELISTED', 'SUSPENDED') DEFAULT 'ACTIVE',
  is_active BOOLEAN DEFAULT TRUE,
  INDEX idx_stocks_company_name (company_name),
  INDEX idx_stocks_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 4. 종목 세부 정보
-- =========================================================
CREATE TABLE stock_details (
  stock_id INT PRIMARY KEY,
  description TEXT,
  ceo_name VARCHAR(50),
  industry_detail VARCHAR(100),
  market_cap BIGINT,
  listing_date DATE,
  total_shares BIGINT,
  homepage_url VARCHAR(255),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_stock_details_stock
    FOREIGN KEY (stock_id)
    REFERENCES stocks(stock_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 5. 일별 시세
-- =========================================================
CREATE TABLE stock_price_daily (
  price_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  stock_id INT NOT NULL,
  trade_date DATE NOT NULL,
  open_price DECIMAL(18, 4),
  high_price DECIMAL(18, 4),
  low_price DECIMAL(18, 4),
  close_price DECIMAL(18, 4),
  volume BIGINT,
  UNIQUE KEY uk_stock_price_daily_stock_date (stock_id, trade_date),
  INDEX idx_price_date (trade_date),
  CONSTRAINT fk_stock_price_daily_stock
    FOREIGN KEY (stock_id)
    REFERENCES stocks(stock_id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 6. 학습 주제 분류
-- =========================================================
CREATE TABLE learning_topics (
  topic_id INT AUTO_INCREMENT PRIMARY KEY,
  topic_name VARCHAR(100) NOT NULL,
  description TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 7. 문제 카테고리
-- 난이도별 문제 출제 유형
-- =========================================================
CREATE TABLE quiz_categories (
  category_id INT AUTO_INCREMENT PRIMARY KEY,
  investment_level_id INT NOT NULL,
  category_code VARCHAR(100) NOT NULL,
  category_name VARCHAR(100) NOT NULL,
  description TEXT,
  problem_direction TEXT,
  sort_order INT NOT NULL DEFAULT 1,
  status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_quiz_category_code (category_code),
  UNIQUE KEY uk_quiz_category_level_name (investment_level_id, category_name),
  INDEX idx_quiz_category_level (investment_level_id, status, sort_order),
  CONSTRAINT fk_quiz_categories_investment_level
    FOREIGN KEY (investment_level_id)
    REFERENCES investment_levels(investment_level_id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 8. 문제 카테고리 세부 내용
-- =========================================================
CREATE TABLE quiz_category_details (
  detail_id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT NOT NULL,
  detail_code VARCHAR(100) NOT NULL,
  detail_name VARCHAR(100) NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 1,
  status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_quiz_category_detail_code (detail_code),
  UNIQUE KEY uk_quiz_category_detail_name (category_id, detail_name),
  INDEX idx_quiz_category_detail (category_id, status, sort_order),
  CONSTRAINT fk_quiz_category_details_category
    FOREIGN KEY (category_id)
    REFERENCES quiz_categories(category_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 9. 개념 내용
-- =========================================================
CREATE TABLE learning_contents (
  content_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  topic_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  content LONGTEXT NOT NULL,
  summary TEXT,
  investment_level_id INT,
  step_order INT NOT NULL DEFAULT 1,
  estimated_minutes INT DEFAULT 5,
  image_url VARCHAR(500),
  status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_learning_contents_topic
    FOREIGN KEY (topic_id)
    REFERENCES learning_topics(topic_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_learning_contents_investment_level
    FOREIGN KEY (investment_level_id)
    REFERENCES investment_levels(investment_level_id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 10. 퀴즈 문제
-- =========================================================
CREATE TABLE quiz_questions (
  question_id INT AUTO_INCREMENT PRIMARY KEY,
  topic_id INT NOT NULL,
  investment_level_id INT,
  category_id INT,
  question_type ENUM('MULTIPLE_CHOICE', 'OX') NOT NULL,
  question_text TEXT NOT NULL,
  explanation TEXT,
  reward_cash INT DEFAULT 0,
  status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_quiz_topic (topic_id),
  INDEX idx_quiz_level (investment_level_id),
  INDEX idx_quiz_category (category_id),
  INDEX idx_quiz_status (status),
  CONSTRAINT fk_quiz_questions_topic
    FOREIGN KEY (topic_id)
    REFERENCES learning_topics(topic_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_quiz_questions_investment_level
    FOREIGN KEY (investment_level_id)
    REFERENCES investment_levels(investment_level_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_quiz_questions_category
    FOREIGN KEY (category_id)
    REFERENCES quiz_categories(category_id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 11. 문제별 세부 내용 연결
-- =========================================================
CREATE TABLE quiz_question_details (
  question_id INT NOT NULL,
  detail_id INT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (question_id, detail_id),
  INDEX idx_quiz_question_detail_detail (detail_id),
  CONSTRAINT fk_quiz_question_details_question
    FOREIGN KEY (question_id)
    REFERENCES quiz_questions(question_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_quiz_question_details_detail
    FOREIGN KEY (detail_id)
    REFERENCES quiz_category_details(detail_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 12. 객관식 보기
-- =========================================================
CREATE TABLE quiz_choices (
  choice_id INT AUTO_INCREMENT PRIMARY KEY,
  question_id INT NOT NULL,
  choice_no INT NOT NULL,
  choice_text TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT FALSE,
  UNIQUE KEY uk_quiz_choice_no (question_id, choice_no),
  CONSTRAINT fk_quiz_choices_question
    FOREIGN KEY (question_id)
    REFERENCES quiz_questions(question_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 13. 문제 풀이 기록
-- =========================================================
CREATE TABLE quiz_attempts (
  attempt_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  question_id INT NOT NULL,
  selected_choice_id INT,
  is_correct BOOLEAN,
  reward_cash_earned INT DEFAULT 0,
  solved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_attempt_user (user_id),
  CONSTRAINT fk_quiz_attempts_user
    FOREIGN KEY (user_id)
    REFERENCES users(user_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_quiz_attempts_question
    FOREIGN KEY (question_id)
    REFERENCES quiz_questions(question_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_quiz_attempts_selected_choice
    FOREIGN KEY (selected_choice_id)
    REFERENCES quiz_choices(choice_id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 14. 찜한 문제
-- =========================================================
CREATE TABLE quiz_bookmarks (
  user_id INT NOT NULL,
  question_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, question_id),
  CONSTRAINT fk_quiz_bookmarks_user
    FOREIGN KEY (user_id)
    REFERENCES users(user_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_quiz_bookmarks_question
    FOREIGN KEY (question_id)
    REFERENCES quiz_questions(question_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 15. 가상 투자 계좌
-- =========================================================
CREATE TABLE simulation_accounts (
  account_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  seed_money DECIMAL(18, 2) NOT NULL,
  cash_balance DECIMAL(18, 2) NOT NULL,
  total_asset_value DECIMAL(18, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_account_user (user_id),
  CONSTRAINT fk_simulation_accounts_user
    FOREIGN KEY (user_id)
    REFERENCES users(user_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 16. 현금 변동 이력
-- =========================================================
CREATE TABLE account_cash_histories (
  cash_history_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL,
  history_type ENUM('REWARD', 'BUY', 'SELL', 'DEPOSIT', 'WITHDRAW') NOT NULL,
  amount DECIMAL(18, 2) NOT NULL,
  balance_after DECIMAL(18, 2) NOT NULL,
  ref_type VARCHAR(50),
  ref_id BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cash_history_type (history_type),
  CONSTRAINT fk_account_cash_histories_account
    FOREIGN KEY (account_id)
    REFERENCES simulation_accounts(account_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 17. 가상 매매 내역
-- =========================================================
CREATE TABLE simulated_trades (
  trade_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL,
  stock_id INT NOT NULL,
  trade_type ENUM('BUY', 'SELL') NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(18, 2) NOT NULL,
  total_amount DECIMAL(18, 2) NOT NULL,
  traded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_trade_date (traded_at),
  CONSTRAINT fk_simulated_trades_account
    FOREIGN KEY (account_id)
    REFERENCES simulation_accounts(account_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_simulated_trades_stock
    FOREIGN KEY (stock_id)
    REFERENCES stocks(stock_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 18. 현재 보유 종목
-- =========================================================
CREATE TABLE portfolio_holdings (
  holding_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL,
  stock_id INT NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  avg_buy_price DECIMAL(18, 2) NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_portfolio_holdings_account_stock (account_id, stock_id),
  CONSTRAINT fk_portfolio_holdings_account
    FOREIGN KEY (account_id)
    REFERENCES simulation_accounts(account_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_portfolio_holdings_stock
    FOREIGN KEY (stock_id)
    REFERENCES stocks(stock_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 19. 기간별 수익률 스냅샷
-- =========================================================
CREATE TABLE portfolio_daily_snapshots (
  snapshot_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL,
  snapshot_date DATE NOT NULL,
  cash_balance DECIMAL(18, 2) NOT NULL,
  stock_value DECIMAL(18, 2) NOT NULL,
  total_asset_value DECIMAL(18, 2) NOT NULL,
  UNIQUE KEY uk_portfolio_daily_snapshots_account_date (account_id, snapshot_date),
  INDEX idx_snapshot_date (snapshot_date),
  CONSTRAINT fk_portfolio_daily_snapshots_account
    FOREIGN KEY (account_id)
    REFERENCES simulation_accounts(account_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 20. AI 채팅 세션
-- question_id: 문제 기반 AI Q&A 연결
-- stock_id: 종목 기반 AI 분석 연결
-- =========================================================
CREATE TABLE ai_chat_sessions (
  session_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  question_id INT NULL,
  user_id INT NOT NULL,
  stock_id INT NULL,
  session_type ENUM('ANALYSIS', 'FEEDBACK', 'GENERAL') NOT NULL DEFAULT 'GENERAL',
  title VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_chat_user (user_id),
  INDEX idx_chat_question (question_id),
  INDEX idx_chat_stock (stock_id),
  CONSTRAINT fk_ai_chat_sessions_user
    FOREIGN KEY (user_id)
    REFERENCES users(user_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_ai_chat_sessions_stock
    FOREIGN KEY (stock_id)
    REFERENCES stocks(stock_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_ai_chat_sessions_question
    FOREIGN KEY (question_id)
    REFERENCES quiz_questions(question_id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 21. AI 메시지 기록
-- =========================================================
CREATE TABLE ai_chat_messages (
  message_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_id BIGINT NOT NULL,
  sender_type ENUM('USER', 'AI') NOT NULL,
  message_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_msg_session_time (session_id, created_at),
  CONSTRAINT fk_ai_chat_messages_session
    FOREIGN KEY (session_id)
    REFERENCES ai_chat_sessions(session_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 22. 매매 피드백
-- =========================================================
CREATE TABLE trade_feedbacks (
  feedback_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  trade_id BIGINT NOT NULL UNIQUE,
  feedback_type VARCHAR(50),
  content TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_trade_feedbacks_trade
    FOREIGN KEY (trade_id)
    REFERENCES simulated_trades(trade_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 23. 랭킹 시즌
-- =========================================================
CREATE TABLE ranking_seasons (
  season_id INT AUTO_INCREMENT PRIMARY KEY,
  season_name VARCHAR(100) NOT NULL,
  start_at TIMESTAMP NOT NULL,
  end_at TIMESTAMP NOT NULL,
  initial_seed_money DECIMAL(18, 2) NOT NULL,
  status ENUM('UPCOMING', 'ACTIVE', 'FINISHED') DEFAULT 'UPCOMING',
  INDEX idx_season_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 24. 시즌 참가 기록
-- =========================================================
CREATE TABLE ranking_entries (
  entry_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  season_id INT NOT NULL,
  user_id INT NOT NULL,
  final_return_rate DECIMAL(10, 4),
  final_rank INT,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_ranking_entries_season_user (season_id, user_id),
  CONSTRAINT fk_ranking_entries_season
    FOREIGN KEY (season_id)
    REFERENCES ranking_seasons(season_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_ranking_entries_user
    FOREIGN KEY (user_id)
    REFERENCES users(user_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 25. 이미지 파일 관리
-- =========================================================
CREATE TABLE images (
  image_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  file_size BIGINT,
  content_type VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 초기 데이터: 투자 등급 / 토픽 / 사용자 / 종목 / 퀴즈 / 모의투자 / AI 테스트
-- DART API는 DB 테이블을 만들지 않고 .env의 DART_API_KEY로 외부 조회 후 AI Context로 사용
-- =========================================================

INSERT INTO investment_levels (investment_level_id, level_name, description)
VALUES
(1, '초급', '주식 기본 개념 학습 단계'),
(2, '중급', '재무지표와 차트를 함께 이해하는 단계'),
(3, '고급', '시장 흐름과 리스크를 종합적으로 판단하는 단계'),
(4, '입문', '주식을 처음 접하는 사용자를 위한 단계');

-- =========================================================
-- 초기 데이터: 문제 카테고리
-- =========================================================
INSERT INTO quiz_categories
(category_id, investment_level_id, category_code, category_name, description, problem_direction, sort_order)
VALUES
(1, 1, 'BEGINNER_STOCK_BASIC', '주식 기본 개념', '주식, 주가, 시가총액, 배당, 거래량', '주식 용어 이해', 1),
(2, 1, 'BEGINNER_FINANCIAL_BASIC', '재무지표 기초', 'PER, ROE, EPS, PBR', '지표가 의미하는 바 이해', 2),
(3, 1, 'BEGINNER_CHART_BASIC', '차트 기초', '상승, 하락, 횡보, 거래량 증가 및 감소', '차트 흐름을 단순 해석', 3),
(4, 1, 'BEGINNER_FINANCIAL_PRODUCT', '금융상품 기초', '예금, 적금, 채권, 펀드, ETF', '상품별 특징 구분', 4),
(5, 1, 'BEGINNER_RISK_BASIC', '투자 위험 기초', '원금 손실, 변동성, 분산투자', '투자 위험 이해', 5),

(6, 2, 'INTERMEDIATE_FINANCIAL_COMBINATION', '재무지표 조합 판단', 'PER + ROE, 매출 성장률, 영업이익률', '기업의 수익성과 성장성 판단', 1),
(7, 2, 'INTERMEDIATE_CHART_ANALYSIS', '차트 분석 기초', '추세, 지지선, 저항선, 거래량 변화', '주가 흐름 해석', 2),
(8, 2, 'INTERMEDIATE_INDICATOR_CONCEPT', '보조지표 개념', '이동평균선, RSI, MACD, 볼린저밴드', '보조지표의 의미와 역할 이해', 3),
(9, 2, 'INTERMEDIATE_NEWS_ANALYSIS', '뉴스 해석', '호재, 악재, 시장 반응', '뉴스가 주가에 미치는 영향 이해', 4),
(10, 2, 'INTERMEDIATE_DISCLOSURE_ANALYSIS', '공시 해석', '실적 발표, 계약 공시, 유상증자, 배당', '공시 내용을 투자 관점으로 해석', 5),
(11, 2, 'INTERMEDIATE_INDUSTRY_COMPARISON', '업종 비교', '같은 업종 내 기업 비교', '상대적으로 나은 기업 판단', 6),
(12, 2, 'INTERMEDIATE_INVESTOR_PROFILE', '투자 성향별 판단', '안정형, 성장형, 공격형', '성향에 맞는 투자 선택', 7),

(13, 3, 'ADVANCED_HISTORICAL_DECISION', '과거 시점 투자 판단', '특정 날짜 기준 차트, 재무, 뉴스 제공', '당시 기준으로 매수, 보유, 매도 판단', 1),
(14, 3, 'ADVANCED_INDICATOR_DECISION', '보조지표 활용 판단', 'RSI, MACD, 이동평균선, 거래량, 볼린저밴드', '기술적 지표를 활용한 투자 판단', 2),
(15, 3, 'ADVANCED_INVESTMENT_STRATEGY', '종합 투자 전략', '가치투자, 성장주 투자, 모멘텀 투자', '전략에 맞는 판단 선택', 3),
(16, 3, 'ADVANCED_RISK_ANALYSIS', '리스크 분석', '고평가, 악재 공시, 실적 악화, 시장 하락', '투자 위험 요소 파악', 4),
(17, 3, 'ADVANCED_PORTFOLIO_DECISION', '포트폴리오 판단', '여러 종목 또는 금융상품 조합', '자산 배분 판단', 5),
(18, 3, 'ADVANCED_EVENT_DECISION', '이벤트 기반 판단', '실적 발표, 금리 변화, 정책 이슈', '이벤트 전후 투자 판단', 6),
(19, 3, 'ADVANCED_EVIDENCE_SELECTION', '투자 근거 선택', '차트, PER, ROE, 뉴스, 공시, 보조지표', '가장 타당한 근거 선택', 7);

-- =========================================================
-- 초기 데이터: 카테고리 세부 내용
-- =========================================================
INSERT INTO quiz_category_details
(detail_id, category_id, detail_code, detail_name, description, sort_order)
VALUES
(1, 1, 'STOCK', '주식', '기업의 소유권 일부를 나타내는 증권', 1),
(2, 1, 'STOCK_PRICE', '주가', '시장에서 거래되는 주식의 가격', 2),
(3, 1, 'MARKET_CAP', '시가총액', '주가와 발행주식 수를 곱한 기업 가치 지표', 3),
(4, 1, 'DIVIDEND', '배당', '기업 이익을 주주에게 분배하는 것', 4),
(5, 1, 'VOLUME_BASIC', '거래량', '일정 기간 거래된 주식 수량', 5),

(6, 2, 'PER_BASIC', 'PER', '주가수익비율의 의미', 1),
(7, 2, 'ROE_BASIC', 'ROE', '자기자본이익률의 의미', 2),
(8, 2, 'EPS_BASIC', 'EPS', '주당순이익의 의미', 3),
(9, 2, 'PBR_BASIC', 'PBR', '주가순자산비율의 의미', 4),

(10, 3, 'UPTREND_BASIC', '상승', '주가가 전반적으로 오르는 흐름', 1),
(11, 3, 'DOWNTREND_BASIC', '하락', '주가가 전반적으로 내리는 흐름', 2),
(12, 3, 'SIDEWAYS_BASIC', '횡보', '주가가 일정 범위에서 움직이는 흐름', 3),
(13, 3, 'VOLUME_CHANGE_BASIC', '거래량 증가/감소', '거래량 변화의 기본 의미', 4),

(14, 4, 'DEPOSIT', '예금', '일정 금액을 맡기고 이자를 받는 상품', 1),
(15, 4, 'INSTALLMENT_SAVINGS', '적금', '일정 기간 금액을 나누어 납입하는 상품', 2),
(16, 4, 'BOND', '채권', '정부나 기업에 자금을 빌려주고 이자를 받는 증권', 3),
(17, 4, 'FUND', '펀드', '여러 투자자의 자금을 모아 운용하는 상품', 4),
(18, 4, 'ETF', 'ETF', '거래소에서 주식처럼 거래되는 펀드', 5),

(19, 5, 'PRINCIPAL_LOSS', '원금 손실', '투자 원금이 줄어들 수 있는 위험', 1),
(20, 5, 'VOLATILITY', '변동성', '가격이 오르내리는 정도', 2),
(21, 5, 'DIVERSIFICATION', '분산투자', '여러 자산에 나누어 투자하여 위험을 줄이는 방법', 3),

(22, 6, 'PER_ROE_COMBINATION', 'PER + ROE', '가격 수준과 수익성을 함께 판단', 1),
(23, 6, 'REVENUE_GROWTH_RATE', '매출 성장률', '매출 증가 추세 판단', 2),
(24, 6, 'OPERATING_MARGIN', '영업이익률', '본업의 수익성 판단', 3),

(25, 7, 'TREND', '추세', '주가의 전반적인 진행 방향', 1),
(26, 7, 'SUPPORT_LINE', '지지선', '주가 하락이 지지될 가능성이 있는 가격대', 2),
(27, 7, 'RESISTANCE_LINE', '저항선', '주가 상승이 제한될 가능성이 있는 가격대', 3),
(28, 7, 'VOLUME_CHANGE', '거래량 변화', '거래량 증감과 주가 흐름 해석', 4),

(29, 8, 'MOVING_AVERAGE_CONCEPT', '이동평균선', '일정 기간 평균 주가를 연결한 지표', 1),
(30, 8, 'RSI_CONCEPT', 'RSI', '과매수와 과매도 수준을 판단하는 지표', 2),
(31, 8, 'MACD_CONCEPT', 'MACD', '추세와 모멘텀 변화를 파악하는 지표', 3),
(32, 8, 'BOLLINGER_BAND_CONCEPT', '볼린저밴드', '가격 변동 범위를 나타내는 지표', 4),

(33, 9, 'POSITIVE_NEWS', '호재', '주가에 긍정적으로 작용할 수 있는 뉴스', 1),
(34, 9, 'NEGATIVE_NEWS', '악재', '주가에 부정적으로 작용할 수 있는 뉴스', 2),
(35, 9, 'MARKET_REACTION', '시장 반응', '뉴스 발표 후 실제 주가와 거래량의 반응', 3),

(36, 10, 'EARNINGS_DISCLOSURE', '실적 발표', '매출과 이익 등 경영 성과 공시', 1),
(37, 10, 'CONTRACT_DISCLOSURE', '계약 공시', '공급계약 및 수주 관련 공시', 2),
(38, 10, 'RIGHTS_OFFERING', '유상증자', '신주 발행으로 자본을 조달하는 공시', 3),
(39, 10, 'DIVIDEND_DISCLOSURE', '배당', '배당금 또는 배당정책 관련 공시', 4),

(40, 11, 'SAME_INDUSTRY_COMPARISON', '같은 업종 내 기업 비교', '동일 업종 기업의 지표와 성과를 비교', 1),

(41, 12, 'CONSERVATIVE_PROFILE', '안정형', '낮은 변동성과 원금 보전을 중시하는 성향', 1),
(42, 12, 'GROWTH_PROFILE', '성장형', '성장 가능성과 적정 위험을 함께 고려하는 성향', 2),
(43, 12, 'AGGRESSIVE_PROFILE', '공격형', '높은 위험을 감수하고 높은 수익을 추구하는 성향', 3),

(44, 13, 'HISTORICAL_CHART', '특정 날짜 기준 차트', '기준 날짜까지의 차트 데이터', 1),
(45, 13, 'HISTORICAL_FINANCIAL', '특정 날짜 기준 재무', '기준 날짜 당시 확인 가능한 재무 데이터', 2),
(46, 13, 'HISTORICAL_NEWS', '특정 날짜 기준 뉴스', '기준 날짜 당시 공개된 뉴스', 3),

(47, 14, 'RSI_DECISION', 'RSI', 'RSI를 실제 투자 판단에 활용', 1),
(48, 14, 'MACD_DECISION', 'MACD', 'MACD를 실제 투자 판단에 활용', 2),
(49, 14, 'MOVING_AVERAGE_DECISION', '이동평균선', '이동평균선을 실제 투자 판단에 활용', 3),
(50, 14, 'VOLUME_DECISION', '거래량', '거래량을 실제 투자 판단에 활용', 4),
(51, 14, 'BOLLINGER_BAND_DECISION', '볼린저밴드', '볼린저밴드를 실제 투자 판단에 활용', 5),

(52, 15, 'VALUE_INVESTING', '가치투자', '기업 가치 대비 저평가 여부를 중시하는 전략', 1),
(53, 15, 'GROWTH_INVESTING', '성장주 투자', '미래 성장성과 실적 증가를 중시하는 전략', 2),
(54, 15, 'MOMENTUM_INVESTING', '모멘텀 투자', '가격과 수급의 상승 흐름을 중시하는 전략', 3),

(55, 16, 'OVERVALUATION', '고평가', '기업 가치 대비 주가가 높을 가능성', 1),
(56, 16, 'NEGATIVE_DISCLOSURE', '악재 공시', '투자 판단에 부정적인 공시', 2),
(57, 16, 'EARNINGS_DETERIORATION', '실적 악화', '매출 또는 이익의 감소', 3),
(58, 16, 'MARKET_DECLINE', '시장 하락', '전체 시장 약세로 발생하는 위험', 4),

(59, 17, 'MULTI_STOCK_PORTFOLIO', '여러 종목 조합', '여러 종목으로 구성된 포트폴리오', 1),
(60, 17, 'FINANCIAL_PRODUCT_ALLOCATION', '금융상품 조합', '주식 외 금융상품을 포함한 자산 배분', 2),

(61, 18, 'EARNINGS_EVENT', '실적 발표', '실적 발표 전후의 투자 판단', 1),
(62, 18, 'INTEREST_RATE_CHANGE', '금리 변화', '금리 변화가 시장과 기업에 미치는 영향', 2),
(63, 18, 'POLICY_ISSUE', '정책 이슈', '정부 정책 및 규제 변화의 영향', 3),

(64, 19, 'CHART_EVIDENCE', '차트', '가격과 거래량 흐름을 투자 근거로 활용', 1),
(65, 19, 'PER_EVIDENCE', 'PER', 'PER을 투자 근거로 활용', 2),
(66, 19, 'ROE_EVIDENCE', 'ROE', 'ROE를 투자 근거로 활용', 3),
(67, 19, 'NEWS_EVIDENCE', '뉴스', '뉴스를 투자 근거로 활용', 4),
(68, 19, 'DISCLOSURE_EVIDENCE', '공시', '공시를 투자 근거로 활용', 5),
(69, 19, 'INDICATOR_EVIDENCE', '보조지표', '기술적 보조지표를 투자 근거로 활용', 6);

INSERT INTO users
(
  user_id,
  email,
  password_hash,
  name,
  nickname,
  phone,
  role,
  status,
  investment_level_id,
  profile_image_url
)
VALUES
(
  1,
  'sonjoo1@dongyang.ac.kr',
  '$2b$10$NOBYfXZ88Vbl/7Ho78SMSuUTDKosFsNkZZN45y3qqDsAwe5u7.NJ6',
  '홍길동',
  '스톡메이트',
  '010-1234-5678',
  'USER',
  'ACTIVE',
  1,
  NULL
);

INSERT INTO learning_topics (topic_id, topic_name, description)
VALUES
(1, '투자 기초', '주식 투자 기본 개념'),
(2, 'PER', '주가수익비율 개념'),
(3, 'PBR', '주가순자산비율 개념'),
(4, '재무제표', '매출액, 영업이익, 당기순이익 등 재무제표 해석'),
(5, '차트 기초', '주가 차트와 거래량 이해');

INSERT INTO learning_contents
(
  topic_id,
  title,
  content,
  summary,
  investment_level_id,
  step_order,
  estimated_minutes,
  image_url,
  status
)
VALUES
(
  2,
  'PER 기초 개념',
  'PER은 주가를 주당순이익으로 나눈 지표로, 기업의 이익 대비 주가 수준을 판단할 때 사용한다.',
  'PER은 주가와 이익의 관계를 나타내는 기본 투자 지표이다.',
  1,
  1,
  5,
  NULL,
  'ACTIVE'
);

INSERT INTO stocks
(stock_id, ticker, company_name, market, sector, currency, status, is_active)
VALUES
(1, '005930', '삼성전자', 'KOSPI', '반도체', 'KRW', 'ACTIVE', true),
(2, '000660', 'SK하이닉스', 'KOSPI', '반도체', 'KRW', 'ACTIVE', true),
(3, '035420', 'NAVER', 'KOSPI', '인터넷', 'KRW', 'ACTIVE', true);

INSERT INTO stock_details
(stock_id, description, ceo_name, industry_detail, market_cap, listing_date, total_shares, homepage_url)
VALUES
(1, '대한민국 대표 종합 반도체 및 전자 기업', '한종희', '메모리 반도체, 모바일, 가전', 400000000000000, '1975-06-11', 5969782550, 'https://www.samsung.com'),
(2, '메모리 반도체 전문 기업', '곽노정', 'DRAM, NAND', 150000000000000, '1996-12-26', 728002365, 'https://www.skhynix.com'),
(3, '검색, 커머스, 콘텐츠, 클라우드 사업을 운영하는 인터넷 플랫폼 기업', '최수연', '인터넷 플랫폼', 30000000000000, '2008-11-28', 164049085, 'https://www.navercorp.com');

INSERT INTO stock_price_daily
(stock_id, trade_date, open_price, high_price, low_price, close_price, volume)
VALUES
(1, '2026-05-20', 73000, 74200, 72500, 73800, 15000000),
(1, '2026-05-21', 73800, 74500, 73200, 74000, 13000000),
(1, '2026-05-22', 74000, 74800, 73500, 74600, 16000000),
(2, '2026-05-20', 190000, 194000, 188000, 193000, 3000000),
(2, '2026-05-21', 193000, 196000, 191000, 195000, 2800000),
(2, '2026-05-22', 195000, 198000, 192000, 197000, 3200000),
(3, '2026-05-20', 180000, 184000, 178000, 182000, 1200000),
(3, '2026-05-21', 182000, 185000, 179000, 181000, 1100000),
(3, '2026-05-22', 181000, 186000, 180000, 185000, 1400000);

INSERT INTO quiz_questions
(
  question_id,
  topic_id,
  investment_level_id,
  category_id,
  question_type,
  question_text,
  explanation,
  reward_cash,
  status
)
VALUES
(
  1,
  2,
  1,
  2,
  'MULTIPLE_CHOICE',
  'PER이 낮다고 항상 저평가된 기업이라고 볼 수 없는 이유는?',
  'PER은 업종 평균, 성장성, 일회성 이익 등 여러 요소를 함께 고려해야 합니다.',
  1000,
  'ACTIVE'
);

INSERT INTO quiz_choices
(question_id, choice_no, choice_text, is_correct)
VALUES
(1, 1, 'PER이 낮으면 항상 성장성이 높기 때문이다.', false),
(1, 2, 'PER은 기업의 부채 규모만 반영하기 때문이다.', false),
(1, 3, '업종 특성과 일회성 이익 등의 영향을 받을 수 있기 때문이다.', true),
(1, 4, 'PER은 기업 매출액만으로 계산되기 때문이다.', false);

INSERT INTO quiz_questions
(
  question_id,
  topic_id,
  investment_level_id,
  category_id,
  question_type,
  question_text,
  explanation,
  reward_cash,
  status
)
VALUES
(
  2,
  1,
  1,
  1,
  'OX',
  '주식은 기업의 소유권 일부를 의미한다.',
  '주식은 기업이 발행한 지분 증권으로, 보유자는 기업의 일부 소유권을 가진다고 볼 수 있습니다.',
  500,
  'ACTIVE'
);

INSERT INTO quiz_choices
(question_id, choice_no, choice_text, is_correct)
VALUES
(2, 1, 'O', true),
(2, 2, 'X', false);

INSERT INTO quiz_question_details
(question_id, detail_id, is_primary)
VALUES
(1, 6, TRUE),
(2, 1, TRUE);

INSERT INTO quiz_attempts
(user_id, question_id, selected_choice_id, is_correct, reward_cash_earned)
SELECT
  1,
  1,
  choice_id,
  true,
  1000
FROM quiz_choices
WHERE question_id = 1
  AND is_correct = true
LIMIT 1;

INSERT INTO quiz_bookmarks
(user_id, question_id)
VALUES
(1, 1);

INSERT INTO simulation_accounts
(account_id, user_id, seed_money, cash_balance, total_asset_value)
VALUES
(1, 1, 10000000, 9260000, 10000000);

INSERT INTO simulated_trades
(trade_id, account_id, stock_id, trade_type, quantity, unit_price, total_amount)
VALUES
(1, 1, 1, 'BUY', 10, 74000, 740000);

INSERT INTO portfolio_holdings
(account_id, stock_id, quantity, avg_buy_price)
VALUES
(1, 1, 10, 74000);

INSERT INTO account_cash_histories
(account_id, history_type, amount, balance_after, ref_type, ref_id)
VALUES
(1, 'BUY', -740000, 9260000, 'TRADE', 1),
(1, 'REWARD', 1000, 9261000, 'QUIZ', 1);

INSERT INTO portfolio_daily_snapshots
(account_id, snapshot_date, cash_balance, stock_value, total_asset_value)
VALUES
(1, '2026-05-22', 9260000, 746000, 10006000);

INSERT INTO ai_chat_sessions
(session_id, question_id, user_id, stock_id, session_type, title)
VALUES
(1, 1, 1, NULL, 'GENERAL', '문제 1 AI 질문 테스트');

INSERT INTO ai_chat_messages
(message_id, session_id, sender_type, message_text)
VALUES
(1, 1, 'USER', 'PER이 낮으면 무조건 좋은 건가요?'),
(2, 1, 'AI', 'PER은 업종 특성, 성장성, 일회성 이익 등을 함께 봐야 합니다.');

INSERT INTO ai_chat_sessions
(session_id, question_id, user_id, stock_id, session_type, title)
VALUES
(2, NULL, 1, 1, 'ANALYSIS', '삼성전자 종목 분석 테스트');

INSERT INTO ai_chat_messages
(message_id, session_id, sender_type, message_text)
VALUES
(3, 2, 'USER', '삼성전자 재무 상태를 초급자 기준으로 설명해줘.'),
(4, 2, 'AI', '삼성전자는 반도체와 전자제품 사업을 중심으로 하는 대형 기업입니다. 재무 상태는 매출, 영업이익, 부채비율 등을 함께 봐야 합니다.');

INSERT INTO ranking_seasons
(season_id, season_name, start_at, end_at, initial_seed_money, status)
VALUES
(1, '2026 상반기 모의투자 시즌', '2026-05-01 00:00:00', '2026-06-30 23:59:59', 10000000, 'ACTIVE');

INSERT INTO ranking_entries
(season_id, user_id, final_return_rate, final_rank)
VALUES
(1, 1, NULL, NULL);

INSERT INTO images
(image_id, file_name, file_path, file_url, file_size, content_type)
VALUES
(1, 'profile-test.png', '/uploads/images/profile-test.png', '/uploads/images/profile-test.png', 102400, 'image/png');

-- 확인용
SELECT * FROM users;
SELECT * FROM investment_levels;
SELECT * FROM learning_topics;
SELECT * FROM quiz_categories;
SELECT * FROM quiz_category_details;
SELECT * FROM quiz_questions;
SELECT * FROM quiz_question_details;
SELECT * FROM quiz_choices;
SELECT * FROM stocks;
SELECT * FROM ai_chat_sessions;
SELECT * FROM ai_chat_messages;