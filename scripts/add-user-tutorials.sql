CREATE TABLE IF NOT EXISTS user_tutorials (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  tutorial_type ENUM(
    'INVESTMENT_LEARNING',
    'PERSONALIZED_LEARNING',
    'CONCEPT_SUMMARY',
    'QUIZ',
    'LEARNING_PROGRESS'
  ) NOT NULL,
  completed TINYINT(1) NOT NULL DEFAULT 0,
  completed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_tutorials_user_type (user_id, tutorial_type),
  KEY idx_user_tutorials_user (user_id),
  CONSTRAINT fk_user_tutorials_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE
);
