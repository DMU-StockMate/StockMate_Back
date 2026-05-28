CREATE TABLE IF NOT EXISTS stock_investment_indicators (
  indicator_id BIGINT NOT NULL AUTO_INCREMENT,
  stock_id INT NOT NULL,
  trade_date DATE NOT NULL,
  per DECIMAL(18, 4) DEFAULT NULL,
  pbr DECIMAL(18, 4) DEFAULT NULL,
  eps DECIMAL(18, 4) DEFAULT NULL,
  bps DECIMAL(18, 4) DEFAULT NULL,
  roe DECIMAL(18, 4) DEFAULT NULL,
  dividend_yield DECIMAL(18, 4) DEFAULT NULL,
  dps DECIMAL(18, 4) DEFAULT NULL,
  source VARCHAR(50) NOT NULL DEFAULT 'KRX',
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (indicator_id),
  UNIQUE KEY uk_stock_investment_indicators_stock_date (stock_id, trade_date),
  KEY idx_stock_investment_indicators_stock_date (stock_id, trade_date),
  CONSTRAINT stock_investment_indicators_stock_id_fk
    FOREIGN KEY (stock_id) REFERENCES stocks(stock_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
