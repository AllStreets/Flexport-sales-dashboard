# Deployment Guide

Two independently deployed services:

- **Frontend** — React SPA → **Vercel**
- **Backend** — Express API + SQLite → **Railway**

Total cost on the free / starter tiers: ~$5/month (Railway hobby plan); Vercel hobby is free.

---

## Frontend — Vercel

1. Push the repo to GitHub.
2. [vercel.com](https://vercel.com) → New Project → Import → select `Flexport-sales-dashboard`.
3. Set **Root Directory** to `frontend`. Vercel auto-detects Vite — no other build settings needed.
4. Add the single required environment variable in Vercel Dashboard → Settings → Environment Variables:

   ```
   VITE_API_URL=https://<your-backend>.railway.app
   ```

   Without this, the frontend falls back to `localhost:5001` and every `/api/*` call fails in production.

5. Redeploy. Subsequent pushes to `main` redeploy automatically.

SPA client-side routing is handled by `frontend/vercel.json`:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```

The dev server runs on port **5174** (`vite.config.js` pins this with `strictPort: true`). Production is whatever URL Vercel assigns.

---

## Backend — Railway

1. [railway.app](https://railway.app) → New Project → Deploy from GitHub Repo.
2. Select `Flexport-sales-dashboard`. Set **Root Directory** to `backend`.
3. Railway detects Node.js (engines pinned to `24.x` in `backend/package.json`) and uses the `start` script:

   ```
   node initDb.js && node data/seedProspects.js && node server.js
   ```

   This creates the schema, applies idempotent `ALTER TABLE` migrations, seeds 250 prospects across 15 sectors, and starts the API on every cold start. No manual database setup is ever required — redeploys regenerate the catalog.

4. Set environment variables (Railway Dashboard → Variables):

   ```
   OPENAI_API_KEY=sk-...                       # Required — all AI features
   FRED_API_KEY=...                            # Optional — Trade Intelligence macro tiles
   NEWSAPI_KEY=...                             # Optional — signals + trigger events + port congestion
   SERPER_API_KEY=...                          # Optional — prospect web enrichment
   EXCHANGE_RATE_API_KEY=...                   # Optional — live FX rates (16 pairs)
   AISSTREAM_API_KEY=...                       # Optional — Ocean Freight live vessels (WebSocket)
   TERMINAL49_API_KEY=...                      # Optional — container tracking (35+ carriers)
   FRONTEND_URL=https://<your>.vercel.app      # Required — CORS allowlist
   PORT=                                       # DO NOT SET — Railway injects this
   ```

   `FRONTEND_URL` seeds the CORS allowlist. All `*.vercel.app` subdomains are auto-allowed, so Vercel preview deployments work without changes.

5. Deploy. Subsequent pushes to `main` redeploy automatically.

### About each optional key

| Key | Free tier? | Without it |
|---|---|---|
| `AISSTREAM_API_KEY` | Yes ([aisstream.io](https://aisstream.io)) | Ocean Freight shows 250 simulated vessels on 62 great-circle lanes. Badge: `SIMULATED`. |
| `FRED_API_KEY` | Yes ([fred.stlouisfed.org](https://fred.stlouisfed.org)) | Trade Intelligence tiles show cached values or `—`. |
| `NEWSAPI_KEY` | Yes ([newsapi.org](https://newsapi.org)) | Signal feed shows a static signal set; port disruption rings stay on baseline status. |
| `EXCHANGE_RATE_API_KEY` | Yes ([exchangerate-api.com](https://www.exchangerate-api.com)) | FX panel shows static reference rates with a `REF` badge. |
| `SERPER_API_KEY` | Yes ([serper.dev](https://serper.dev)) | Prospect enrichment falls back to seeded `companies.json`. |
| `TERMINAL49_API_KEY` | Paid only ([terminal49.com](https://terminal49.com)) | Container Tracker on Ocean Freight returns 503 on submit. |

Live aircraft come from [adsb.lol](https://adsb.lol)'s free API — no key required. If it's rate-limited, the Air Freight page falls back to ~200 simulated planes on 67 routes.

---

## Database

SQLite (`flexport.db`). On Railway the file lives on the ephemeral filesystem and resets on each redeploy — this is by design. The `start` script re-seeds prospects every cold start, and AIS vessel positions are mirrored to `vessel_cache` every 5 minutes (and on `SIGTERM`) so they restore on the next boot.

**Important**: WAL mode is intentionally **off**. Railway's ephemeral filesystem leaves WAL sidecar files behind across redeploys, which corrupts the DB header on cold start. The backend uses `db.configure('busyTimeout', 5000)` instead.

If you need persistent prospect data across deploys (e.g. real CRM state), provision a Postgres database on Railway and swap the `sqlite3` calls in `backend/services/` and `backend/initDb.js` for a `pg` connection. The service layer is thin — this is a few hours of work, not a rewrite.

---

## Local Development

```bash
# Terminal 1 — backend on http://localhost:5001
cd backend
npm install
cp .env.example .env          # add OPENAI_API_KEY at minimum
node initDb.js                # idempotent
node data/seedProspects.js    # idempotent
npm run dev                   # nodemon server.js
```

```bash
# Terminal 2 — frontend on http://localhost:5174
cd frontend
npm install
npm run dev
```

`frontend/.env`:
```
VITE_API_URL=http://localhost:5001
```

---

## Verifying a Production Deployment

Open your Vercel URL and walk through this checklist:

1. **Home** — globe and port ticker load within 2–3 seconds.
2. **Ocean Freight** (`/vessels`) — animated route arcs appear within 3 seconds. Header badge shows:
   - **`LIVE AIS`** (green) — AISstream WebSocket is open, vessels < 5 min old
   - **`LIVE (CACHED)`** (amber) — vessels in cache but last AIS message > 5 min
   - **`AIS DOWN`** (red) — WebSocket not open, cache served as fallback
   - **`SIMULATED`** (slate) — no live vessels at all; 250 simulated rendered
   Click the badge to toggle to forced simulated mode.
3. **Market Map** (`/market`) — sector nodes render with pipeline stage colors.
4. **Account 360** — open any prospect → **Run Full Analysis** — AI text streams in.
5. **Trade Intelligence** (`/trade`) — macro tiles show FRED data; FX Rates panel shows `LIVE` badge.
6. **Live Call Mode** (`Ctrl+Shift+L`) — search returns prospects from the seeded database.
7. **Settings → Server Health** — `/api/settings/health` returns `ws: "open"` and `cacheSize > 0`.
8. **DevTools → Network** — all `/api/*` calls return 200 from your Railway URL, not localhost.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| CORS error on every API call | `FRONTEND_URL` missing or mismatched on Railway | Set it to the exact Vercel URL and redeploy. `*.vercel.app` is auto-allowed for previews. |
| All `/api/*` calls go to `localhost` | `VITE_API_URL` missing on Vercel | Set it to your Railway URL and redeploy the frontend. |
| Globe renders blank | Browser disabled hardware acceleration | Check `chrome://gpu` or DevTools → WebGL. The globe needs WebGL2. |
| AI features return 500 | `OPENAI_API_KEY` invalid or out of credits | Verify on Railway; check OpenAI usage dashboard. |
| Ocean Freight stays `SIMULATED` even with key | AIS WebSocket can't reach `wss://stream.aisstream.io` | Check `/api/settings/health` → `ais.ws`. If `connecting`, the connect-timeout (30s) should force a reconnect within a minute. Restart the service if stuck. |
| Ocean Freight badge flips between `LIVE AIS` and `AIS DOWN` | NAT/firewall dropping idle WS connections | Heartbeat (30s) and watchdog (90s) should reconnect automatically. Check Railway logs for `aisstream disconnected` lines and the backoff schedule. |
| Container tracker returns 503 | `TERMINAL49_API_KEY` not set | Add to Railway variables. |
| FX Rates shows `REF` badge | `EXCHANGE_RATE_API_KEY` not set | Add to Railway variables. |
| Macro tiles show `—` | `FRED_API_KEY` not set or rate-limited | Add to Railway variables. Free tier is 120 req/min — plenty. |
| Signal feed shows static signals | `NEWSAPI_KEY` not set | Add to Railway variables. Free tier is 1000 req/day. |
| Database empty after deploy | Seed script failed silently | Check Railway build logs — seed prints one line per inserted prospect (250 total). |
| Hot Prospects panel empty | Seed didn't produce prospects with `icp_score >= 70` | Re-run `node data/seedProspects.js` locally and verify counts. |
| Air Freight planes are all simulated | adsb.lol rate-limited or unreachable | Fallback to simulated is automatic. No action needed unless you want live. |

---

## Monitoring

`GET /api/settings/health` returns a JSON snapshot useful for uptime monitors:

```json
{
  "status": "ok",
  "version": "2.1.0",
  "timestamp": "2026-05-28T20:00:00.000Z",
  "env": { "openai": true, "newsapi": true, "fred": true, ... },
  "ais": { "ws": "open", "cacheSize": 49987, "lastMsgAgoSec": 0 }
}
```

Wire this into UptimeRobot / BetterStack / your own pinger. Alert on:

- `status != "ok"`
- `ais.ws != "open"` for more than 10 minutes (the WS reconnect logic should clear faster than this)
- `ais.cacheSize == 0` for more than 30 minutes after start (the DB restore should populate it within 5 seconds of boot)
