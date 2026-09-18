CREATE TABLE IF NOT EXISTS student_id_change_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    requested_student_id VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    evidence_url VARCHAR(500) NULL,
    admin_note TEXT NULL,
    reviewed_by INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME NULL,
    INDEX ix_student_id_change_requests_student_id (student_id),
    INDEX ix_student_id_change_requests_requested_student_id (requested_student_id),
    INDEX ix_student_id_change_requests_status (status),
    CONSTRAINT fk_student_id_change_requests_student
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    CONSTRAINT fk_student_id_change_requests_admin
        FOREIGN KEY (reviewed_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- requested_student_id is checked against non-OAUTH student IDs by the API
-- because MySQL cannot express that cross-table conditional uniqueness rule.