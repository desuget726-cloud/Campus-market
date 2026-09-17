CREATE TABLE IF NOT EXISTS support_tickets (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id VARCHAR(50) NULL,
    requester_name VARCHAR(150) NULL,
    requester_email VARCHAR(150) NULL,
    category VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    attachment_url VARCHAR(500) NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'open',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX ix_support_tickets_user_id (user_id),
    INDEX ix_support_tickets_status (status)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;