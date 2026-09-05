# Google Custom Search setup

Create or update `Backend/.env` with the following values:

```env
GOOGLE_API_KEY=your_google_api_key
GOOGLE_CSE_ID=your_custom_search_engine_id
```

To obtain them:

1. In Google Cloud Console, enable the **Custom Search JSON API** for a project.
2. Create an API key and use it as `GOOGLE_API_KEY`.
3. Create a Programmable Search Engine and use its Search engine ID as `GOOGLE_CSE_ID`.
4. Restart Uvicorn after changing `.env`.

The backend requests up to four results from `https://www.googleapis.com/customsearch/v1`. Missing credentials, invalid keys, timeouts, and quota errors are logged and treated as unavailable web context; local marketplace search continues to work.

Keep `.env` private and never commit real API keys. Restrict the Google key to the Custom Search JSON API and, where practical, to the local development environment.