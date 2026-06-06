CREATE TABLE IF NOT EXISTS simulation_accounts (
  account_id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  seed_money DECIMAL(18, 2) NOT NULL,
  cash_balance DECIMAL(18, 2) NOT NULL,
  total_asset_value DECIMAL(18, 2) NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (account_id),
  KEY idx_account_user (user_id),
  CONSTRAINT simulation_accounts_ibfk_1
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS portfolio_holdings (
  holding_id BIGINT NOT NULL AUTO_INCREMENT,
  account_id INT NOT NULL,
  stock_id INT NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  avg_buy_price DECIMAL(18, 2) NOT NULL,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (holding_id),
  UNIQUE KEY account_id (account_id, stock_id),
  KEY stock_id (stock_id),
  CONSTRAINT portfolio_holdings_ibfk_1
    FOREIGN KEY (account_id) REFERENCES simulation_accounts(account_id)
    ON DELETE CASCADE,
  CONSTRAINT portfolio_holdings_ibfk_2
    FOREIGN KEY (stock_id) REFERENCES stocks(stock_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS simulated_trades (
  trade_id BIGINT NOT NULL AUTO_INCREMENT,
  account_id INT NOT NULL,
  stock_id INT NOT NULL,
  trade_type ENUM('BUY', 'SELL') NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(18, 2) NOT NULL,
  total_amount DECIMAL(18, 2) NOT NULL,
  traded_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (trade_id),
  KEY idx_trade_date (traded_at),
  KEY account_id (account_id),
  KEY stock_id (stock_id),
  CONSTRAINT simulated_trades_ibfk_1
    FOREIGN KEY (account_id) REFERENCES simulation_accounts(account_id)
    ON DELETE CASCADE,
  CONSTRAINT simulated_trades_ibfk_2
    FOREIGN KEY (stock_id) REFERENCES stocks(stock_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS account_cash_histories (
  cash_history_id BIGINT NOT NULL AUTO_INCREMENT,
  account_id INT NOT NULL,
  history_type ENUM('REWARD', 'BUY', 'SELL', 'DEPOSIT', 'WITHDRAW') NOT NULL,
  amount DECIMAL(18, 2) NOT NULL,
  balance_after DECIMAL(18, 2) NOT NULL,
  ref_type VARCHAR(50) DEFAULT NULL,
  ref_id BIGINT DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (cash_history_id),
  KEY idx_cash_history_type (history_type),
  KEY account_id (account_id),
  CONSTRAINT account_cash_histories_ibfk_1
    FOREIGN KEY (account_id) REFERENCES simulation_accounts(account_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
