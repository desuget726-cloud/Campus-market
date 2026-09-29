ALTER TABLE students
    ADD COLUMN missed_acceptance_count INT NOT NULL DEFAULT 0,
    ADD COLUMN suspended_until DATETIME NULL;

ALTER TABLE orders
    ADD COLUMN paid_at DATETIME NULL,
    ADD COLUMN seller_accept_deadline DATETIME NULL,
    ADD COLUMN expired_at DATETIME NULL,
    ADD COLUMN refund_status VARCHAR(20) NOT NULL DEFAULT 'none',
    ADD COLUMN refund_reference VARCHAR(100) NULL,
    ADD COLUMN refund_attempts INT NOT NULL DEFAULT 0,
    ADD COLUMN seller_reminder_12h_sent BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN seller_reminder_22h_sent BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN platform_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    ADD COLUMN seller_commission DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    ADD INDEX ix_orders_status_seller_accept_deadline (status, seller_accept_deadline);

UPDATE orders
SET paid_at = COALESCE(paid_at, created_at),
    seller_accept_deadline = DATE_ADD(COALESCE(paid_at, created_at), INTERVAL 24 HOUR)
WHERE status = 'Pending'
  AND payment_status = 'Successful'
  AND seller_accept_deadline IS NULL;
