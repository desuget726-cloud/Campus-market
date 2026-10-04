CREATE TABLE IF NOT EXISTS user_sessions (
  id CHAR(36) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  device_name VARCHAR(255) NOT NULL,
  location VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_active_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at DATETIME NULL,
  CONSTRAINT fk_user_sessions_user_id
    FOREIGN KEY (user_id) REFERENCES students (student_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX ix_user_sessions_user_id_revoked_at (user_id, revoked_at)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
