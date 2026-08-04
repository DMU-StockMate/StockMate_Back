CREATE TABLE IF NOT EXISTS investment_profiles (
  user_id INT NOT NULL,
  risk_score INT NOT NULL,
  risk_type ENUM('CONSERVATIVE','MODERATE_CONSERVATIVE','BALANCED','AGGRESSIVE','VERY_AGGRESSIVE') NOT NULL,
  knowledge_score INT NOT NULL,
  recommended_level_id INT NOT NULL,
  answers JSON NOT NULL,
  profile_version VARCHAR(10) NOT NULL,
  diagnosed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_investment_profiles_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_investment_profiles_level
    FOREIGN KEY (recommended_level_id) REFERENCES investment_levels(investment_level_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
