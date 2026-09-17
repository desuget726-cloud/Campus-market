# Campace Market

## Google OAuth setup

Google sign-in is handled by the FastAPI backend using Authorization Code flow with PKCE.

1. Open [Google Cloud Console](https://console.cloud.google.com/), create or select a project, and configure the OAuth consent screen.
2. Create an OAuth client under **APIs & Services > Credentials > Create Credentials > OAuth client ID**.
3. Choose **Web application** and add this authorized redirect URI for local development:

   `http://127.0.0.1:8000/auth/google/callback`

4. Copy `Backend/.env.example` to `Backend/.env` and set:

   ```env
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   GOOGLE_REDIRECT_URI=http://127.0.0.1:8000/auth/google/callback
   FRONTEND_LOGIN_URL=http://localhost:5173/login
   ```

5. Set `studentVerification.allowedEmailDomain` to the institution's domain. New Google accounts are rejected unless their verified email matches that domain.
6. Start the backend before opening the frontend. Missing OAuth variables produce a startup error listing the missing names.

For production, use HTTPS URLs in Google Cloud Console and the environment variables. Never commit `Backend/.env` or expose the client secret.
