-- Optional one-time migration. Review the affected rows before running the UPDATE.
-- Orders already more than 24 hours old will expire on the next deadline job.
SELECT id, status, created_at, seller_accept_deadline
FROM orders
WHERE LOWER(status) = 'pending'
ORDER BY created_at;

START TRANSACTION;

UPDATE orders
SET seller_accept_deadline = DATE_ADD(created_at, INTERVAL 24 HOUR)
WHERE LOWER(status) = 'pending'
  AND (
    seller_accept_deadline IS NULL
    OR seller_accept_deadline <> DATE_ADD(created_at, INTERVAL 24 HOUR)
  );

COMMIT;
