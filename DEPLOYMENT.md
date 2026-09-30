# Production Deployment

## Render backend

Connect the Render backend service to its MySQL provider. The application accepts `DATABASE_URL` or Railway's `MYSQL_URL` / `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, and `MYSQLDATABASE` variables.

Set these backend variables in Render. Values marked `replace-with-your-value` must be supplied in Render and are intentionally absent from this repository:

```text
CORS_ORIGINS=https://campus-market-gamma-eight.vercel.app
CHAPA_SECRET_KEY=replace-with-your-value
CHAPA_WEBHOOK_SECRET=replace-with-your-value
OPENAI_API_KEY=replace-with-your-value
SESSION_SECRET=replace-with-a-long-random-value
CHAPA_PUBLIC_KEY=replace-with-your-value
CHAPA_CALLBACK_URL=https://your-render-service.onrender.com/api/admin/payments/webhook
CHAPA_RETURN_URL=https://campus-market-gamma-eight.vercel.app/
SENDER_EMAIL=replace-with-your-value
SENDER_PASSWORD=replace-with-your-value
GOOGLE_API_KEY=replace-with-your-value
GOOGLE_CSE_ID=replace-with-your-value
```

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

## GitHub safety

`.env` and `.env.*` files are ignored. Keep real values in Render, the database provider, and Vercel environment settings only. Use `.env.example` files for placeholders when developing locally.