-- Two-sided order completion migration.
-- Run once on existing databases that predate the buyer/seller confirmation fields.
ALTER TABLE orders
    ADD COLUMN buyer_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN seller_confirmed BOOLEAN NOT NULL DEFAULT FALSE;
