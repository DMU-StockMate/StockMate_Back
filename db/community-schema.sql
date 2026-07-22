CREATE TABLE IF NOT EXISTS community_posts (
  post_id INT AUTO_INCREMENT PRIMARY KEY,
  board_type ENUM('FREE', 'STOCK') NOT NULL,
  user_id INT NOT NULL,
  stock_id INT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  view_count INT NOT NULL DEFAULT 0,
  like_count INT NOT NULL DEFAULT 0,
  comment_count INT NOT NULL DEFAULT 0,
  status ENUM('ACTIVE', 'DELETED') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,

  INDEX idx_community_posts_board_status_created (
    board_type,
    status,
    created_at
  ),
  INDEX idx_community_posts_stock_status_created (
    stock_id,
    status,
    created_at
  ),
  INDEX idx_community_posts_user (user_id),

  CONSTRAINT fk_community_posts_user
    FOREIGN KEY (user_id)
    REFERENCES users(user_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_community_posts_stock
    FOREIGN KEY (stock_id)
    REFERENCES stocks(stock_id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS community_comments (
  comment_id INT AUTO_INCREMENT PRIMARY KEY,
  post_id INT NOT NULL,
  user_id INT NOT NULL,
  content TEXT NOT NULL,
  status ENUM('ACTIVE', 'DELETED') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,

  INDEX idx_community_comments_post_status_created (
    post_id,
    status,
    created_at
  ),
  INDEX idx_community_comments_user (user_id),

  CONSTRAINT fk_community_comments_post
    FOREIGN KEY (post_id)
    REFERENCES community_posts(post_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_community_comments_user
    FOREIGN KEY (user_id)
    REFERENCES users(user_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS community_post_likes (
  post_id INT NOT NULL,
  user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, user_id),

  CONSTRAINT fk_community_post_likes_post
    FOREIGN KEY (post_id)
    REFERENCES community_posts(post_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_community_post_likes_user
    FOREIGN KEY (user_id)
    REFERENCES users(user_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
