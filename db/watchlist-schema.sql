CREATE TABLE IF NOT EXISTS watchlists (
  watchlist_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  stock_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (watchlist_id),
  UNIQUE KEY uk_watchlists_user_stock (user_id, stock_id),
  KEY idx_watchlists_user_id (user_id),
  KEY idx_watchlists_stock_id (stock_id),
  CONSTRAINT watchlists_user_id_fk
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE,
  CONSTRAINT watchlists_stock_id_fk
    FOREIGN KEY (stock_id) REFERENCES stocks(stock_id)
    ON DELETE CASCADE
);
