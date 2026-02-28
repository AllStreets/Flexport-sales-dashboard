# Deployment Guide

This app is split into two independently deployable services:

- **Frontend** — static SPA, deploy to Vercel
- **Backend** — Express API + SQLite, deploy to Railway or Render

---

## Frontend — Vercel

### Deploy

1. Push this repo to GitHub (or it's already there).
2. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub.
3. Set the **Root Directory** to `frontend`.
4. Vercel will auto-detect Vite. Build settings are pre-configured in `frontend/vercel.json`.

### Environment variable

In Vercel Dashboard → Project → Settings → Environment Variables:

```
VITE_API_URL=https://your-backend-url.railway.app
```

Redeploy after adding the variable.

The `frontend/vercel.json` already handles SPA client-side routing:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```

---

## Backend — Railway (recommended)

### Deploy

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub.
2. Select this repo. Set the **Root Directory** to `backend`.
3. Railway auto-detects Node.js and runs `npm start`.

The `npm start` script in `backend/package.json` runs:
```
node initDb.js && node data/seedProspects.js && node server.js
```

This initializes the schema and seeds the database on every cold start, then starts the server.

### Environment variables (Railway Dashboard → Variables)

```
CLAUDE_API_KEY=sk-ant-...
FRED_API_KEY=your_fred_key          # optional — macro charts
NEWSAPI_KEY=your_newsapi_key        # optional — signal feed
PORT=5000
FRONTEND_URL=https://your-app.vercel.app
```

`FRONTEND_URL` is used by the CORS config to allowlist your Vercel domain. All `*.vercel.app` subdomains are also automatically allowed.

---

## Backend — Render (alternative)

1. Go to [render.com](https://render.com) → New Web Service → Connect GitHub.
2. Set **Root Directory** to `backend`.
3. Build command: `npm install`
4. Start command: `node initDb.js && node data/seedProspects.js && node server.js`
5. Add the same environment variables listed above under the Render service's Environment tab.

---

## Database

The app uses SQLite (`flexport.db`). On Railway and Render, the file lives on the ephemeral filesystem — it resets on each deploy. This is fine because `npm start` re-seeds the database automatically.

For a persistent database, swap `better-sqlite3` for a Postgres connection string and update the service files in `backend/services/`.

---

## Verifying the deployment

1. Visit your Vercel frontend URL — the globe and signal ticker should load.
2. Open any prospect → Account 360 should stream AI analysis.
3. Check the browser Network tab — all `/api/*` calls should return 200 from your Railway URL.

### Common issues

| Symptom | Fix |
|---|---|
| `CORS error` on API calls | Set `FRONTEND_URL` on the backend to your exact Vercel URL |
| API calls going to localhost | Set `VITE_API_URL` on Vercel and redeploy |
| Globe doesn't render | Three.js loads fine on Vercel; check browser console for WebGL errors |
| AI features return 500 | Verify `CLAUDE_API_KEY` is set and has credits |
