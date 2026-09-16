-- Run once after backing up the database.
-- Remove payout providers that have never been used by an account or transaction.
DELETE provider
FROM payout_providers AS provider
LEFT JOIN seller_payment_accounts AS account ON account.provider_id = provider.id
LEFT JOIN payout_transactions AS transaction ON transaction.provider_id = provider.id
WHERE account.id IS NULL
  AND transaction.id IS NULL;

-- Prevent duplicate provider names within the same payout type.
ALTER TABLE payout_providers
    ADD UNIQUE KEY uq_payout_providers_name_type (name, type);
