# Production Deployment

## Render backend

Connect the Render backend service to its MySQL provider. The application accepts `DATABASE_URL` or Railway's `MYSQL_URL` / `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, and `MYSQLDATABASE` variables.

Set these backend variables in Render. Values marked `replace-with-your-value` must be supplied in Render and are intentionally absent from this repository:

```text
CORS_ORIGINS=https://campus-market-gamma-eight.vercel.app
# Existing wallet deposits still use this legacy Chapa credential.
CHAPA_SECRET_KEY=replace-with-your-value
CHAPA_WEBHOOK_SECRET=replace-with-your-value
# Wallet withdrawals use only the key and webhook secret for the selected mode.
CHAPA_MODE=test
CHAPA_TEST_SECRET_KEY=replace-with-chapa-test-secret
CHAPA_TEST_WEBHOOK_SECRET=replace-with-chapa-test-webhook-secret
CHAPA_LIVE_SECRET_KEY=replace-with-chapa-live-secret
CHAPA_LIVE_WEBHOOK_SECRET=replace-with-chapa-live-webhook-secret
PAYOUT_MIN_AMOUNT_ETB=100.00
PAYOUT_DAILY_LIMIT_ETB=10000.00
PAYOUT_MAX_REQUESTS_PER_HOUR=3
PAYOUT_ADMIN_APPROVAL_THRESHOLD_ETB=5000.00
PAYOUT_TIMEOUT_HOURS=24
OPENAI_API_KEY=replace-with-your-value
SESSION_SECRET=replace-with-a-long-random-value
ADMIN_2FA_BYPASS=false
SELLER_ACCEPTANCE_HOURS=24
CHAPA_PUBLIC_KEY=replace-with-your-value
CHAPA_CALLBACK_URL=https://your-render-service.onrender.com/api/admin/payments/webhook
CHAPA_RETURN_URL=https://campus-market-gamma-eight.vercel.app/
SENDER_EMAIL=replace-with-your-value
SENDER_PASSWORD=replace-with-your-value
GOOGLE_API_KEY=replace-with-your-value
GOOGLE_CSE_ID=replace-with-your-value
```

`ADMIN_2FA_BYPASS` defaults to `false`. Only set it to `true` for supervised recovery
when the sole active administrator cannot complete the required 2FA flow; it permits
that administrator to sign in with the password alone and records a critical audit
entry. Set it back to `false` immediately after recovery.

`SELLER_ACCEPTANCE_HOURS` sets the seller's response window for new paid orders and
defaults to `24`. Existing orders with a stored seller acceptance deadline keep that
deadline unless you deliberately run the optional SQL migration at
`Backend/scripts/update_pending_seller_acceptance_deadlines_24h.sql`.

Render Web Service settings:

```text
Root Directory: /Backend
Build Command: pip install -r requirements.txt
Start Command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
Health Check Path: /health
```

After deployment, verify `https://your-render-service.onrender.com/health` returns `{"status":"ok"}`.

## Vercel frontend

Settings:

```text
Root Directory: CampaceMarket
Build Command: npm run build
Output Directory: dist
Environment Variable: VITE_API_URL=https://your-render-service.onrender.com
```

In the Vercel project settings, set `VITE_API_URL` to the actual Render service's public origin (for example, `https://your-render-service.onrender.com`), with no trailing slash. Redeploy the Vercel project after adding or changing this variable so Vite includes it in the build.

On Render, set `CORS_ORIGINS=https://campus-market-gamma-eight.vercel.app` (no trailing slash). The backend also allows this production origin if `CORS_ORIGINS` is omitted, and normalizes a trailing slash if one is supplied.

Do not put database credentials or backend secrets in any `VITE_` variable.

Large withdrawals at or above `PAYOUT_ADMIN_APPROVAL_THRESHOLD_ETB` remain held and do not call Chapa until an administrator approves them. Admins can list them with `GET /api/admin/payouts/pending-approval` and approve selected IDs with `POST /api/admin/payouts/reconcile` using `{"payout_ids":[1],"action":"approve"}`. For production payouts, set `CHAPA_MODE=live` and configure the live transfer and webhook secrets; never reuse test credentials as live credentials.

## GitHub safety

`.env` and `.env.*` files are ignored. Keep real values in Render, the database provider, and Vercel environment settings only. Use `.env.example` files for placeholders when developing locally.