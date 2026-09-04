-- Phase 1: preview duplicate orders. Review this result before Phase 2.
SELECT older.id AS duplicate_id,
       newer.id AS kept_id,
       older.student_id,
       older.product_id,
       older.price,
       older.status AS duplicate_status,
       newer.status AS kept_status
FROM orders AS older
JOIN orders AS newer
  ON newer.student_id = older.student_id
 AND newer.product_id = older.product_id
 AND newer.price = older.price
 AND newer.id > older.id
ORDER BY older.student_id, older.product_id, older.price, older.id;

-- Phase 2: run only after reviewing Phase 1.
-- Export or back up the `orders` table before running this block.
START TRANSACTION;

CREATE TEMPORARY TABLE duplicate_order_ids AS
SELECT older.id
FROM orders AS older
JOIN orders AS newer
  ON newer.student_id = older.student_id
 AND newer.product_id = older.product_id
 AND newer.price = older.price
 AND newer.id > older.id;

-- Delete only the lower-ID duplicate rows.
DELETE o
FROM orders AS o
JOIN duplicate_order_ids AS duplicates ON duplicates.id = o.id;

SELECT ROW_COUNT() AS deleted_duplicate_orders;

DROP TEMPORARY TABLE duplicate_order_ids;

COMMIT;
