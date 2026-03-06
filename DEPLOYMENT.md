# Deployment Guide

The app is two independently deployed services:

- **Frontend** — React SPA → Vercel
- **Backend** — Express API + SQLite → Railway

---

## Frontend — Vercel

### Deploy

1. Push the repo to GitHub.
2. [vercel.com](https://vercel.com) → New Project → Import → select `Flexport-sales-dashboard`.
3. Set **Root Directory** to `frontend`. Vercel auto-detects Vite — no other changes needed.
4. Add environment variable in Vercel Dashboard → Settings → Environment Variables:

```
VITE_API_URL=https://your-backend.railway.app
```

5. Redeploy. Without this variable the frontend falls back to `localhost:5001` and all API features fail in production.

The `frontend/vercel.json` handles SPA client-side routing:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```

Subsequent deploys happen automatically on push to `main`.

---

## Backend — Railway

### Deploy

1. [railway.app](https://railway.app) → New Project → Deploy from GitHub Repo.
2. Select `Flexport-sales-dashboard`. Set **Root Directory** to `backend`.
3. Railway detects Node.js and uses the `start` script in `backend/package.json`:

```
node initDb.js && node data/seedProspects.js && node server.js
```

This creates the schema, runs safe migrations, seeds all 136 prospects, and starts the API on every cold start. No manual database setup required.

### Environment Variables (Railway Dashboard → Variables)

```
OPENAI_API_KEY=sk-...                      # Required — all AI features (GPT-4.1-mini)
FRED_API_KEY=your_fred_key                 # Optional — FRED macro data charts
NEWS_API_KEY=your_newsapi_key              # Optional — live signal feed + trigger events
SERPER_API_KEY=your_serper_key             # Optional — prospect web enrichment
EXCHANGE_RATE_API_KEY=your_key            # Optional — live FX rates
MARINETRAFFIC_API_KEY=your_key            # Optional — live port congestion data
FRONTEND_URL=https://your-app.vercel.app  # Required — CORS allowlist
PORT=                                      # Set automatically by Railway — do not set
```

`FRONTEND_URL` is used by the CORS allowlist. All `*.vercel.app` subdomains are automatically allowed, so Vercel preview deployments work without changes.

Subsequent deploys happen automatically on push to `main`.

---

## Database

The app uses SQLite (`flexport.db`). On Railway the file lives on the ephemeral filesystem and resets on each redeploy — this is by design since `npm start` re-seeds on every cold start.

If you need persistent data across deploys, provision a Postgres database on Railway and replace the `sqlite3` calls in `backend/services/` and `backend/initDb.js` with a `pg` connection.

---

## Local Development

```bash
# Terminal 1 — backend on http://localhost:5001
cd backend
npm install
cp .env.example .env      # add OPENAI_API_KEY at minimum
node initDb.js
node data/seedProspects.js
npm run dev
```

```bash
# Terminal 2 — frontend on http://localhost:3001
cd frontend
npm install
npm run dev
```

Frontend `.env`:
```
VITE_API_URL=http://localhost:5001
```

---

## Verifying a Production Deployment

1. Open the Vercel URL — globe and port ticker load within 2–3 seconds.
2. Navigate to Market Map — sector nodes render with pipeline stage colors.
3. Open any Account 360 → click **Run Full Analysis** — AI text streams in.
4. Open Trade Intelligence → macro tiles show FRED data; FX Rates panel shows **LIVE** badge.
5. Open Live Call Mode (`Ctrl+Shift+L`) — search returns prospects from the seeded database.
6. DevTools → Network tab — all `/api/*` calls return 200 from your Railway URL, not localhost.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| CORS error on all API calls | Set `FRONTEND_URL` on Railway to your exact Vercel URL and redeploy |
| API calls going to `localhost` | Set `VITE_API_URL` on Vercel to your Railway URL and redeploy |
| Globe renders blank | Browser needs hardware acceleration — check WebGL in DevTools console |
| AI features return 500 | Verify `OPENAI_API_KEY` on Railway is valid and has credits |
| FX Rates shows "REF" badge | `EXCHANGE_RATE_API_KEY` not set — add to Railway variables |
| Macro tiles show `—` | `FRED_API_KEY` not set — data falls back to cache; add key to fix |
| Signal feed shows static signals | `NEWS_API_KEY` not set — static fallback signals display |
| Database empty after deploy | Check Railway build logs — seed script logs each inserted row |
| Hot Prospects panel empty | Requires prospects with `icp_score >= 70` — verify seed ran correctly |
