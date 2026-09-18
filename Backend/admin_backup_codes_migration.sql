CREATE TABLE IF NOT EXISTS admin_backup_codes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    admin_id INT NOT NULL,
    code_hash VARCHAR(255) NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX ix_admin_backup_codes_admin_id (admin_id),
    INDEX ix_admin_backup_codes_used (used),
    CONSTRAINT fk_admin_backup_codes_admin
        FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);
