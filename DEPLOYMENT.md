# Deployment Guide

The app is split into two independently deployed services:

- **Frontend** — React SPA deployed to Vercel
- **Backend** — Express API + SQLite deployed to Railway (recommended) or Render

---

## Frontend — Vercel

### Initial deploy

1. Push the repo to GitHub (already done).
2. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub → select `Flexport-sales-dashboard`.
3. Set **Root Directory** to `frontend`.
4. Vercel auto-detects Vite. No build command changes needed.

### Environment variable

In Vercel Dashboard → Project → Settings → Environment Variables, add:

```
VITE_API_URL=https://your-backend.railway.app
```

Redeploy after adding. Without this the frontend calls `http://localhost:5000` and AI/data features will fail in production.

The `frontend/vercel.json` handles SPA client-side routing automatically:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```

### Subsequent deploys

Push to `main` — Vercel redeploys automatically.

---

## Backend — Railway (recommended)

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
CLAUDE_API_KEY=sk-ant-...                       # Required
FRED_API_KEY=your_fred_key                      # Optional — macro charts
NEWSAPI_KEY=your_newsapi_key                    # Optional — live signal feed
PORT=5000                                       # Railway sets this automatically
FRONTEND_URL=https://your-app.vercel.app        # Required for CORS
```

`FRONTEND_URL` is used by the CORS allowlist. All `*.vercel.app` subdomains are also automatically allowed, so preview deployments work without changes.

### Subsequent deploys

Push to `main` — Railway redeploys automatically.

---

## Backend — Render (alternative)

1. Go to [render.com](https://render.com) → New Web Service → Connect GitHub.
2. Set **Root Directory** to `backend`.
3. **Build command:** `npm install`
4. **Start command:** `node initDb.js && node data/seedProspects.js && node server.js`
5. Add environment variables (same list as Railway above) under the service's Environment tab.

---

## Database

The app uses SQLite (`flexport.db`). On Railway and Render, the file is on the ephemeral filesystem — it resets on each redeploy. This is by design: `npm start` re-initializes and re-seeds the database on every cold start, so no manual migration step is needed.

If you need persistent data across deploys, the recommended upgrade path is:

1. Provision a Postgres database on Railway or Render.
2. Replace `sqlite3` with `pg` in `backend/services/`.
3. Update the `getDb()` helper in `backend/server.js` and each service file to use the Postgres connection string.

---

## Local Development (quick reference)

```bash
# Terminal 1 — backend
cd backend
npm install
cp .env.example .env     # add CLAUDE_API_KEY
node initDb.js
node data/seedProspects.js
npm run dev              # nodemon on http://localhost:5000

# Terminal 2 — frontend
cd frontend
npm install
npm run dev              # Vite on http://localhost:3000
```

---

## Verifying a production deployment

1. Open the Vercel URL — the globe and port ticker should load within 2–3 seconds.
2. Click any prospect → Account 360 page should stream AI analysis text.
3. Open browser DevTools → Network tab — all `/api/*` calls should return 200 from your Railway/Render URL (not localhost).
4. Trade Intelligence page → macro tiles should show live FRED data (or indicate "Fetching FRED data..." briefly).

### Common issues

| Symptom | Fix |
|---|---|
| `CORS error` on all API calls | Set `FRONTEND_URL` on the backend to your exact Vercel URL and redeploy |
| API calls going to `localhost` | Set `VITE_API_URL` on Vercel and trigger a redeploy |
| Globe renders blank | Check browser console for WebGL errors — requires hardware acceleration enabled |
| AI features return 500 | Verify `CLAUDE_API_KEY` is set and the Anthropic account has credits |
| Macro tiles show `—` | `FRED_API_KEY` not set — data falls back to cached values; add the key to fix |
| Signal feed shows static signals | `NEWSAPI_KEY` not set — fallback signals display instead; add the key for live feed |
| Database is empty after deploy | The seed script runs automatically on start — check Railway/Render build logs for errors |
