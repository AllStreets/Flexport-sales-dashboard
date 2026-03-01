# Flexport SDR Intelligence Hub — Audit & Test Report
**Date:** 2026-03-01
**Commit:** 966177a

---

## Bugs Fixed (8 total)

| # | Severity | Issue | Fix |
|---|---|---|---|
| 1 | **Critical** | `SaveAnalysisButton` called `/api/save-analysis` (404 on every save) | Changed to `/api/analyses` |
| 2 | **Critical** | Tariff HS Lookup sent `POST` but backend only has `GET` | Converted to `GET ?q=` query param |
| 3 | **Critical** | Account360 state (Pipeline, Call Notes, Objections) leaked between accounts | Full state reset on account navigation |
| 4 | **Critical** | `/api/hot-prospects` never closed SQLite connection (file handle leak) | Added `db.close()` in both callback branches |
| 5 | **High** | Weekly KPI quota used Sunday as week start — disagreed with Mon–Fri table | Fixed to Monday-start offset |
| 6 | **High** | `ProspectSearch` crashed on non-array API error response | Added `Array.isArray()` guard |
| 7 | **High** | `ObjectionDrawer` showed previous account's AI response after navigating accounts | Added reset `useEffect` on `prospect.id` change |
| 8 | **Medium** | Tariff calculator showed `$0` freight when weight field was blank | Applied `Math.max(1, Math.ceil(weight / 1000))` floor |

---

## API Endpoint Health Check

| Endpoint | Status | Notes |
|---|---|---|
| `GET /api/hot-prospects` | PASS | 8 rows, top: Anker Innovations OPP 102 |
| `GET /api/fx-rates` | PASS | Live source, 8 pairs, 7 with real daily pct changes |
| `GET /api/signals` | PASS | NewsAPI dependent — count varies by day |
| `GET /api/performance` | PASS | Calls and emails tracked correctly |
| `GET /api/win-loss` | PASS | 4 records |
| `GET /api/prospects` | PASS | Returns array, Array.isArray guard active |
| `GET /api/account360/:id` | PASS | Prospect + news articles |
| `GET /api/hs-lookup?q=` | PASS | Returns HS code list |
| `GET /api/followup-radar` | PASS | 4 overdue contacts |
| `GET /api/pipeline-velocity` | PASS | 1 active stage |
| `GET /api/trigger-events` | PASS | 2 live events (falls back to 6 static) |
| `GET /api/market-map` | PASS | 15 sector nodes |
| `POST /api/analyses` | PASS | Saves correctly |
| `GET /api/pipeline` | PASS | 6 entries |

---

## Known Limitations (free-tier, not bugs)

- **VND pct** always `0.00%` — frankfurter.app does not carry Vietnamese Dong historical data
- **Signals** may be empty on some days — NewsAPI free tier has article availability limits
- **Trigger Events** falls back to 6 static cards when NewsAPI returns no results

---

## Build Status

```
✓ built in 8.85s — 1052 modules transformed
```
One pre-existing chunk size warning (JS bundle >500kB) — unrelated to these fixes.
