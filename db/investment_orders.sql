CREATE TABLE IF NOT EXISTS investment_orders (
  order_id BIGINT NOT NULL AUTO_INCREMENT,
  account_id INT NOT NULL,
  user_id INT NOT NULL,
  stock_id INT NOT NULL,
  stock_code VARCHAR(20) NOT NULL,
  trading_venue VARCHAR(20) NOT NULL DEFAULT 'KRX',
  side ENUM('BUY', 'SELL') NOT NULL,
  order_type ENUM(
    'MARKET',
    'LIMIT',
    'STOP_LIMIT',
    'RESERVATION',
    'CONDITIONAL_LIMIT',
    'AFTER_HOURS_CLOSE'
  ) NOT NULL,
  status ENUM('PENDING', 'FILLED', 'CANCELLED', 'REJECTED') NOT NULL,
  quantity INT NOT NULL,
  limit_price DECIMAL(18, 2) NULL,
  stop_price DECIMAL(18, 2) NULL,
  execution_order_type VARCHAR(30) NULL,
  reserved_amount DECIMAL(18, 2) NOT NULL DEFAULT 0,
  execution_price DECIMAL(18, 2) NULL,
  filled_at DATETIME NULL,
  cancelled_at DATETIME NULL,
  scheduled_at DATETIME NULL,
  triggered_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (order_id),
  KEY idx_investment_orders_account_status (account_id, status),
  KEY idx_investment_orders_stock_status_type (stock_id, status, order_type),
  CONSTRAINT fk_investment_orders_account
    FOREIGN KEY (account_id)
    REFERENCES simulation_accounts(account_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_investment_orders_user
    FOREIGN KEY (user_id)
    REFERENCES users(user_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_investment_orders_stock
    FOREIGN KEY (stock_id)
    REFERENCES stocks(stock_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
