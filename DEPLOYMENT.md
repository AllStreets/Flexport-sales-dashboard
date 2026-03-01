# Deployment Guide

The app is split into two independently deployed services:

- **Frontend** — React SPA deployed to Vercel
- **Backend** — Express API + SQLite deployed to Railway

---

## Frontend — Vercel

### Initial deploy

1. Push the repo to GitHub.
2. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub → select `Flexport-sales-dashboard`.
3. Set **Root Directory** to `frontend`.
4. Vercel auto-detects Vite. No build command changes needed.

### Environment variable

In Vercel Dashboard → Project → Settings → Environment Variables, add:

```
VITE_API_URL=https://your-backend.railway.app
```

Redeploy after adding. Without this the frontend calls `http://localhost:5001` and all AI/data features will fail in production.

The `frontend/vercel.json` handles SPA client-side routing automatically:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```

### Subsequent deploys

Push to `main` — Vercel redeploys automatically.

---

## Backend — Railway

### Initial deploy

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub Repo.
2. Select `Flexport-sales-dashboard`. Set **Root Directory** to `backend`.
3. Railway detects Node.js and uses the `start` script automatically.

The `npm start` script in `backend/package.json`:

```
node initDb.js && node data/seedProspects.js && node server.js
```

This creates the schema, seeds the prospect database, and starts the server on every cold start.

### Environment variables (Railway Dashboard → Variables)

```
OPENAI_API_KEY=sk-...                       # Required — all AI features (GPT-4.1-mini)
FRED_API_KEY=your_fred_key                  # Optional — FRED macro data charts
NEWS_API_KEY=your_newsapi_key               # Optional — live signal feed + trigger events
SERPER_API_KEY=your_serper_key              # Optional — prospect web enrichment
EXCHANGE_RATE_API_KEY=your_key             # Optional — live FX rates
FRONTEND_URL=https://your-app.vercel.app   # Required — CORS allowlist
PORT=                                       # Set automatically by Railway — do not override
```

`FRONTEND_URL` is used by the CORS allowlist. All `*.vercel.app` subdomains are also automatically allowed, so Vercel preview deployments work without changes.

### Subsequent deploys

Push to `main` — Railway redeploys automatically.

---

## Database

The app uses SQLite (`flexport.db`). On Railway the file lives on the ephemeral filesystem — it resets on each redeploy. This is by design: `npm start` re-initializes and re-seeds the database on every cold start, so no manual migration step is needed.

If you need persistent data across deploys:

1. Provision a Postgres database on Railway.
2. Replace `sqlite3` with `pg` in `backend/services/`.
3. Update the `getDb()` helper in `backend/server.js` and each service file to use the Postgres connection string.

---

## Local Development (quick reference)

```bash
# Terminal 1 — backend (http://localhost:5001)
cd backend
npm install
cp .env.example .env     # add OPENAI_API_KEY at minimum
node initDb.js
node data/seedProspects.js
npm run dev              # nodemon on http://localhost:5001
```

```bash
# Terminal 2 — frontend (http://localhost:3000)
cd frontend
npm install
npm run dev              # Vite on http://localhost:3000
```

Frontend `.env`:
```
VITE_API_URL=http://localhost:5001
```

---

## Verifying a production deployment

1. Open the Vercel URL — the globe and port ticker should load within 2–3 seconds.
2. Go to Market Map — sector nodes should render with live pipeline stage colors.
3. Click any prospect → Account 360 page should stream AI analysis text after clicking "Run Full Analysis".
4. Open Trade Intelligence → macro tiles should show live FRED data, FX Rates panel should show "LIVE" badge with non-zero percentage changes.
5. Open browser DevTools → Network tab — all `/api/*` calls should return 200 from your Railway URL (not localhost).

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `CORS error` on all API calls | Set `FRONTEND_URL` on Railway to your exact Vercel URL and redeploy |
| API calls going to `localhost` | Set `VITE_API_URL` on Vercel to your Railway URL and trigger a redeploy |
| Globe renders blank | Check browser console for WebGL errors — requires hardware acceleration enabled |
| AI features return 500 | Verify `OPENAI_API_KEY` is set correctly on Railway and the account has credits |
| FX Rates shows "REF" badge | `EXCHANGE_RATE_API_KEY` not set — add to Railway variables |
| Macro tiles show `—` | `FRED_API_KEY` not set — data falls back to cached values; add the key to fix |
| Signal feed shows static signals | `NEWS_API_KEY` not set — fallback signals display instead |
| Trigger Events shows static cards | `NEWS_API_KEY` not set — 6 static fallback events display instead |
| Database empty after deploy | The seed script runs on start — check Railway build logs for errors |
| Hot Prospects panel not showing | Requires prospects with `icp_score >= 70` in DB — check seed ran correctly |
