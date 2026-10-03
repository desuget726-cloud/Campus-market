-- Seller payout account hardening
-- 1) Review duplicates without deleting automatically.
SELECT UPPER(student_id), COUNT(*)
FROM seller_payment_accounts
GROUP BY UPPER(student_id)
HAVING COUNT(*) > 1;

-- 2) Normalize existing IDs to uppercase + trim.
UPDATE seller_payment_accounts
SET student_id = UPPER(TRIM(student_id))
WHERE student_id <> UPPER(TRIM(student_id));

-- 3) Add missing schema columns.
ALTER TABLE seller_payment_accounts
  ADD COLUMN IF NOT EXISTS updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS payout_hold_until DATETIME NULL;

-- 4) Create the payout change history table.
CREATE TABLE IF NOT EXISTS seller_payment_account_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  student_id VARCHAR(50) NOT NULL,
  changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  changed_fields JSON NOT NULL,
  old_last4 VARCHAR(10) NULL,
  new_last4 VARCHAR(10) NULL,
  ip_address VARCHAR(50) NULL,
  user_agent VARCHAR(255) NULL,
  INDEX ix_seller_payment_account_history_student_id (student_id),
  INDEX ix_seller_payment_account_history_changed_at (changed_at)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 5) Enforce one payout account per student after duplicates are resolved.
-- This should only be executed when the duplicate check above is empty.
CREATE UNIQUE INDEX uq_seller_payment_accounts_student_id
ON seller_payment_accounts (student_id);
