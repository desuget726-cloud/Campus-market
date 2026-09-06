# Production Deployment

## Railway backend

Create a Railway MySQL service and connect it to the backend service. Railway can provide either `MYSQL_URL` or the individual `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, and `MYSQLDATABASE` variables. The application also accepts `DATABASE_URL`.

Set these backend variables in Railway. Values marked `replace-with-your-value` must be supplied in Railway and are intentionally absent from this repository:

```text
CORS_ORIGINS=https://your-frontend.vercel.app
CHAPA_SECRET_KEY=replace-with-your-value
CHAPA_WEBHOOK_SECRET=replace-with-your-value
OPENAI_API_KEY=replace-with-your-value
SESSION_SECRET=replace-with-a-long-random-value
CHAPA_PUBLIC_KEY=replace-with-your-value
CHAPA_CALLBACK_URL=https://your-backend.up.railway.app/api/admin/payments/webhook
CHAPA_RETURN_URL=https://your-frontend.vercel.app/
SENDER_EMAIL=replace-with-your-value
SENDER_PASSWORD=replace-with-your-value
GOOGLE_API_KEY=replace-with-your-value
GOOGLE_CSE_ID=replace-with-your-value
```

Settings:

```text
Root Directory: /Backend
Build Command: pip install -r requirements.txt
Start Command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

After deployment, verify `https://your-backend.up.railway.app/health` returns `{"status":"ok"}`.

## Vercel frontend

Settings:

```text
Root Directory: CampaceMarket
Build Command: npm run build
Output Directory: dist
Environment Variable: VITE_API_URL=https://your-backend.up.railway.app
```

Replace both example URLs with the actual public URLs in the hosting dashboards. Do not put database credentials or backend secrets in any `VITE_` variable.

## GitHub safety

`.env` and `.env.*` files are ignored. Keep real values in Railway and Vercel environment settings only. Use `.env.example` files for placeholders when developing locally.