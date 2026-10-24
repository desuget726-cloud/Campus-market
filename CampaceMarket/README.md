# Campace Market

## Wallet payments at handover

Orders are created only when a buyer pays the seller from their wallet at handover. Chapa is used for wallet top-ups only; a successful wallet payment credits the seller and immediately completes the order.

The frontend creates and reuses one idempotency key for each product-and-quantity payment intent. It keeps that key when the request outcome is uncertain, and only discards it after a definitive response or when the buyer changes the intent. Retrying with the same key returns the original order without moving money again; using a different key represents a separate payment attempt.

## Google OAuth setup

Google sign-in is handled by the FastAPI backend using Authorization Code flow with PKCE.

1. Open [Google Cloud Console](https://console.cloud.google.com/), create or select a project, and configure the OAuth consent screen.
2. Create an OAuth client under **APIs & Services > Credentials > Create Credentials > OAuth client ID**.
3. Choose **Web application** and add this authorized redirect URI for local development:

   `http://localhost:8000/auth/google/callback`

4. Copy `Backend/.env.example` to `Backend/.env` and set:

   ```env
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback
   FRONTEND_URL=http://localhost:5173
   ```

5. Set `studentVerification.allowedEmailDomain` to the institution's domain. New Google accounts are rejected unless their verified email matches that domain.
6. Start the backend before opening the frontend. Missing OAuth variables produce a startup error listing the missing names.

## Cloudinary file uploads

The backend uploads product images, profile photos, student-ID evidence, and chat attachments through Cloudinary. Add these names to `Backend/.env` on the backend service (values kept in the hosting environment, never committed):

```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

If these are unset, the app falls back to the local `static/uploads` behavior for local development. In production, Cloudinary protects uploads from Render's ephemeral filesystem by storing files in a durable external CDN/storage layer.

For production, use HTTPS URLs in Google Cloud Console and the environment variables. Never commit `Backend/.env` or expose the client secret.
