-- Preview and repair wallet ledger rows incorrectly changed to Wallet Deposit
-- by a Chapa deposit callback that received a payout reference.
-- Review every preview row and confirm provider status before applying.
-- Set @apply_repair = 1 only after review. No payout rows or tx rows are deleted.

SET @student_id = 'MAU1600006';
SET @apply_repair = 0; -- Explicitly change to 1 to apply.

SELECT p.id AS payout_id, p.internal_reference, p.amount AS payout_amount,
       p.status AS payout_status, p.provider_reference, p.created_at,
       t.type AS ledger_type, t.amount AS ledger_amount,
       t.status AS ledger_status, w.balance AS wallet_balance
FROM payout_transactions AS p
LEFT JOIN transactions AS t ON t.tx_id = p.internal_reference
LEFT JOIN wallets AS w ON w.student_id = p.student_id
WHERE p.student_id = @student_id
  AND p.internal_reference LIKE 'PAYOUT-%'
ORDER BY p.created_at;

START TRANSACTION;

SELECT w.id
FROM wallets AS w
WHERE w.student_id = @student_id
FOR UPDATE;

SELECT t.id
FROM transactions AS t
JOIN payout_transactions AS p ON p.internal_reference = t.tx_id
WHERE p.student_id = @student_id
FOR UPDATE;

-- Preview the exact wallet correction and the count of phantom notifications.
SELECT COALESCE(SUM(ABS(p.amount)), 0) AS expected_balance_decrease,
       COUNT(*) AS payout_ledger_rows_to_reclassify
FROM payout_transactions AS p
JOIN transactions AS t ON t.tx_id = p.internal_reference
WHERE p.student_id = @student_id
  AND t.type = 'Wallet Deposit';

SELECT COUNT(*) AS phantom_deposit_notifications
FROM notifications AS n
JOIN payout_transactions AS p ON p.student_id = n.student_id
JOIN transactions AS t ON t.tx_id = p.internal_reference
WHERE p.student_id = @student_id
  AND t.type = 'Wallet Deposit'
  AND n.title = 'Payment Successful'
  AND n.message LIKE CONCAT('%deposit of ', CAST(p.amount AS CHAR), ' ETB%')
  AND n.created_at BETWEEN DATE_SUB(p.created_at, INTERVAL 1 MINUTE)
                       AND DATE_ADD(p.created_at, INTERVAL 1 MINUTE);

-- Remove the phantom credit from each affected wallet. Aggregate first so a
-- wallet with multiple affected payouts gets the full correction in one update.
UPDATE wallets AS w
JOIN (
    SELECT p.student_id, SUM(ABS(p.amount)) AS phantom_credit_total
    FROM payout_transactions AS p
    JOIN transactions AS t ON t.tx_id = p.internal_reference
    WHERE p.student_id = @student_id
      AND t.type = 'Wallet Deposit'
    GROUP BY p.student_id
) AS phantom ON phantom.student_id = w.student_id
SET w.balance = w.balance - phantom.phantom_credit_total,
    w.updated_at = CURRENT_TIMESTAMP
WHERE w.student_id = @student_id
  AND @apply_repair = 1;

-- Restore payout ledger semantics: withdrawals are negative amounts and their
-- type is never Wallet Deposit. Keep failures failed, mark completed payouts
-- successful, and represent in-flight reservations as Processing.
UPDATE transactions AS t
JOIN payout_transactions AS p ON p.internal_reference = t.tx_id
SET t.type = 'Wallet Withdrawal',
    t.amount = -ABS(p.amount),
    t.status = CASE
        WHEN p.status = 'completed' THEN 'Successful'
        WHEN p.status IN ('pending', 'processing') THEN 'Processing'
        WHEN p.status IN ('failed', 'cancelled') THEN 'Failed'
        ELSE t.status
    END,
    t.description = CASE
        WHEN p.status = 'completed' THEN 'Payout completed by the provider.'
        WHEN p.status IN ('pending', 'processing') THEN 'Payout accepted by the provider and awaiting confirmation.'
        ELSE t.description
    END
WHERE p.student_id = @student_id
  AND p.internal_reference LIKE 'PAYOUT-%'
  AND t.type = 'Wallet Deposit'
  AND @apply_repair = 1;

DELETE n
FROM notifications AS n
JOIN payout_transactions AS p ON p.student_id = n.student_id
JOIN transactions AS t ON t.tx_id = p.internal_reference
WHERE p.student_id = @student_id
  AND t.type = 'Wallet Withdrawal'
  AND n.title = 'Payment Successful'
  AND n.message LIKE CONCAT('%deposit of ', CAST(p.amount AS CHAR), ' ETB%')
  AND n.created_at BETWEEN DATE_SUB(p.created_at, INTERVAL 1 MINUTE)
                       AND DATE_ADD(p.created_at, INTERVAL 1 MINUTE)
  AND @apply_repair = 1;

UPDATE students AS s
JOIN wallets AS w ON w.student_id = s.student_id
SET s.wallet_balance = w.balance
WHERE s.student_id = @student_id
  AND @apply_repair = 1;

SELECT p.id AS payout_id, p.internal_reference, p.amount AS payout_amount,
       p.status AS payout_status, t.type AS ledger_type, t.amount AS ledger_amount,
       t.status AS ledger_status, w.balance AS wallet_balance,
       s.wallet_balance AS student_wallet_balance
FROM payout_transactions AS p
LEFT JOIN transactions AS t ON t.tx_id = p.internal_reference
LEFT JOIN wallets AS w ON w.student_id = p.student_id
LEFT JOIN students AS s ON s.student_id = p.student_id
WHERE p.student_id = @student_id
  AND p.internal_reference LIKE 'PAYOUT-%'
ORDER BY p.created_at;

COMMIT;
