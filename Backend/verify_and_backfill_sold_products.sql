-- SQL check and cautious backfill for the application's MySQL/PostgreSQL schemas.
-- The backfill only changes available products with zero remaining stock and
-- a completed, paid, non-refunded order linked through orders.product_id.

BEGIN;

-- a) Inspect exact stored status values, including differences in case/spacing.
SELECT status, COUNT(*) AS product_count
FROM products
GROUP BY status
ORDER BY status;

-- b) Review qualifying orders whose products are still marked available.
SELECT
    p.id AS product_id,
    p.title AS product_title,
    p.status AS product_status,
    p.stock AS remaining_stock,
    o.id AS order_id,
    o.status AS order_status,
    o.payment_status,
    o.refund_status
FROM products AS p
JOIN orders AS o ON o.product_id = p.id
WHERE LOWER(TRIM(COALESCE(o.status, ''))) = 'completed'
  AND LOWER(TRIM(COALESCE(o.payment_status, ''))) IN ('successful', 'paid', 'completed')
  AND LOWER(TRIM(COALESCE(o.refund_status, 'none'))) IN ('', 'none')
  AND LOWER(TRIM(COALESCE(p.status, ''))) IN ('approved', 'active', 'available')
ORDER BY p.id, o.id;

-- c) Backfill only sold-out products. Do not mark an item sold when stock remains.
UPDATE products
SET status = 'Sold'
WHERE COALESCE(products.stock, 0) = 0
  AND LOWER(TRIM(COALESCE(products.status, ''))) IN ('approved', 'active', 'available')
  AND EXISTS (
      SELECT 1
      FROM orders AS o
      WHERE o.product_id = products.id
        AND LOWER(TRIM(COALESCE(o.status, ''))) = 'completed'
        AND LOWER(TRIM(COALESCE(o.payment_status, ''))) IN ('successful', 'paid', 'completed')
        AND LOWER(TRIM(COALESCE(o.refund_status, 'none'))) IN ('', 'none')
  );

COMMIT;
