-- Review and, only after confirming with Chapa that the duplicate was NOT sent,
-- repair a duplicate pair of 1,000 ETB withdrawals (example IDs 27 and 28).
-- This script is intentionally a no-op unless the operator changes the gate to 1.
-- Do not infer "not sent" solely from local payout status/reference fields.

SET @kept_payout_id = 27;
SET @duplicate_payout_id = 28;
SET @provider_confirmed_duplicate_unsent = 0; -- Change to 1 only after external Chapa confirmation.

-- Preview the records before making any changes.
SELECT p.id, p.internal_reference, p.amount, p.status, p.provider_reference,
       p.created_at, t.type AS ledger_type, t.amount AS ledger_amount,
       t.status AS ledger_status, w.balance AS wallet_balance
FROM payout_transactions AS p
LEFT JOIN transactions AS t ON t.tx_id = p.internal_reference
LEFT JOIN wallets AS w ON w.student_id = p.student_id
WHERE p.id IN (@kept_payout_id, @duplicate_payout_id)
ORDER BY p.id;

START TRANSACTION;

SELECT id
FROM payout_transactions
WHERE id IN (@kept_payout_id, @duplicate_payout_id)
FOR UPDATE;

-- Only cancel the duplicate when explicitly confirmed unsent, same owner/amount,
-- and still in a local state that has not already been cancelled.
UPDATE payout_transactions AS duplicate_payout
JOIN payout_transactions AS kept_payout
  ON kept_payout.id = @kept_payout_id
 AND kept_payout.student_id = duplicate_payout.student_id
 AND kept_payout.amount = duplicate_payout.amount
SET duplicate_payout.status = 'cancelled',
    duplicate_payout.failure_reason = 'Duplicate request; confirmed not sent to Chapa.'
WHERE duplicate_payout.id = @duplicate_payout_id
  AND duplicate_payout.status IN ('pending', 'processing', 'completed')
  AND @provider_confirmed_duplicate_unsent = 1;

SET @cancelled_duplicate_rows = ROW_COUNT();

-- Reclassify the kept payment as a debit and exclude the unsent duplicate from
-- ledger totals. The wallet gets exactly one 1,000 ETB debit from its current
-- value, which removes the phantom deposit credit while retaining one payout.
UPDATE transactions AS kept_tx
JOIN payout_transactions AS kept_payout
  ON kept_payout.internal_reference = kept_tx.tx_id
SET kept_tx.type = 'Wallet Withdrawal',
    kept_tx.amount = -ABS(kept_payout.amount),
    kept_tx.status = 'Successful',
    kept_tx.description = 'Verified Chapa wallet withdrawal.'
WHERE kept_payout.id = @kept_payout_id
  AND kept_payout.status = 'completed'
  AND @cancelled_duplicate_rows = 1;

UPDATE transactions AS duplicate_tx
JOIN payout_transactions AS duplicate_payout
  ON duplicate_payout.internal_reference = duplicate_tx.tx_id
SET duplicate_tx.type = 'Wallet Withdrawal',
    duplicate_tx.amount = -ABS(duplicate_payout.amount),
    duplicate_tx.status = 'Cancelled',
    duplicate_tx.description = 'Duplicate withdrawal cancelled; provider confirmed it was not sent.'
WHERE duplicate_payout.id = @duplicate_payout_id
  AND duplicate_payout.status = 'cancelled'
  AND @cancelled_duplicate_rows = 1;

UPDATE wallets AS w
JOIN payout_transactions AS kept_payout ON kept_payout.student_id = w.student_id
SET w.balance = w.balance - ABS(kept_payout.amount),
    w.updated_at = CURRENT_TIMESTAMP
WHERE kept_payout.id = @kept_payout_id
  AND kept_payout.status = 'completed'
  AND @cancelled_duplicate_rows = 1;

UPDATE students AS s
JOIN wallets AS w ON w.student_id = s.student_id
JOIN payout_transactions AS kept_payout ON kept_payout.student_id = s.student_id
SET s.wallet_balance = w.balance
WHERE kept_payout.id = @kept_payout_id
  AND @cancelled_duplicate_rows = 1;

-- Remove only the phantom deposit-success notices created alongside these two
-- payout requests; leave all other payment notifications intact.
DELETE n
FROM notifications AS n
JOIN payout_transactions AS p ON p.student_id = n.student_id
WHERE p.id IN (@kept_payout_id, @duplicate_payout_id)
  AND @cancelled_duplicate_rows = 1
  AND n.title = 'Payment Successful'
  AND n.message LIKE 'Your Chapa wallet deposit of%'
  AND n.created_at BETWEEN DATE_SUB(p.created_at, INTERVAL 1 MINUTE)
                       AND DATE_ADD(p.created_at, INTERVAL 1 MINUTE);

SELECT @cancelled_duplicate_rows AS duplicate_rows_cancelled;
COMMIT;
