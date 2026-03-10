# Land Freight Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Land Freight globe page — topology texture, 315+ animated truck sprites (regular + tank), route arcs, port data, border crossing rings, and a full right-side intelligence panel — matching the pattern of the existing Ocean Freight and Air Freight pages.

**Architecture:** Six tasks in dependency order: backend endpoint first, then CSS, panel, globe, page wrapper, and finally App/Sidebar wiring. Each task is a self-contained commit. The page mirrors `FlightsPage.jsx` / `FlightsGlobe.jsx` / `FGPanel.jsx` exactly — same RAF loop animation, same sprite map pattern, same dim-to-bright arc scheme — just with trucks instead of planes.

**Tech Stack:** React 19, react-globe.gl, Three.js, Express 5, react-icons/ri (RiTruckLine). No new npm packages required.

---

## Task 1: Backend `/api/trucks` endpoint

**Files:**
- Modify: `backend/server.js` (insert before line 1550 — before `if (require.main === module)`)

**Step 1: Add the TRUCK_LANES data array and buildSimulatedTrucks function**

Insert this block in `backend/server.js`, right before the `if (require.main === module)` block at line 1550:

```javascript
// ── Land Freight — 79 highway corridors, 316 simulated trucks ────────────────
const TRUCK_LANES = [
  // ── North America — US Interstate ──
  { sl: 34.0, sg: -118.2, dl: 40.7, dg: -74.0,  sn: 'Los Angeles', dn: 'New York',        type: 'regular', carrier: 'JB Hunt'      },
  { sl: 41.9, sg: -87.6,  dl: 34.0, dg: -118.2, sn: 'Chicago',     dn: 'Los Angeles',     type: 'regular', carrier: 'Schneider'    },
  { sl: 40.7, sg: -74.0,  dl: 41.9, dg: -87.6,  sn: 'New York',    dn: 'Chicago',         type: 'regular', carrier: 'Werner'       },
  { sl: 25.8, sg: -80.2,  dl: 33.7, dg: -84.4,  sn: 'Miami',       dn: 'Atlanta',         type: 'regular', carrier: 'Old Dominion' },
  { sl: 33.7, sg: -84.4,  dl: 41.9, dg: -87.6,  sn: 'Atlanta',     dn: 'Chicago',         type: 'regular', carrier: 'XPO'          },
  { sl: 33.7, sg: -84.4,  dl: 32.8, dg: -96.8,  sn: 'Atlanta',     dn: 'Dallas',          type: 'regular', carrier: 'JB Hunt'      },
  { sl: 32.8, sg: -96.8,  dl: 33.7, dg: -84.4,  sn: 'Dallas',      dn: 'Atlanta',         type: 'regular', carrier: 'Werner'       },
  { sl: 34.0, sg: -118.2, dl: 32.8, dg: -96.8,  sn: 'Los Angeles', dn: 'Dallas',          type: 'regular', carrier: 'Schneider'    },
  { sl: 32.8, sg: -96.8,  dl: 41.9, dg: -87.6,  sn: 'Dallas',      dn: 'Chicago',         type: 'regular', carrier: 'JB Hunt'      },
  { sl: 29.8, sg: -95.4,  dl: 32.8, dg: -96.8,  sn: 'Houston',     dn: 'Dallas',          type: 'tank',    carrier: 'Schneider'    },
  { sl: 29.8, sg: -95.4,  dl: 29.95,dg: -90.1,  sn: 'Houston',     dn: 'New Orleans',     type: 'tank',    carrier: 'Werner'       },
  { sl: 41.9, sg: -87.6,  dl: 35.1, dg: -90.0,  sn: 'Chicago',     dn: 'Memphis',         type: 'regular', carrier: 'Old Dominion' },
  { sl: 35.1, sg: -90.0,  dl: 33.7, dg: -84.4,  sn: 'Memphis',     dn: 'Atlanta',         type: 'regular', carrier: 'XPO'          },
  { sl: 34.0, sg: -118.2, dl: 33.4, dg: -112.1, sn: 'Los Angeles', dn: 'Phoenix',         type: 'regular', carrier: 'JB Hunt'      },
  { sl: 33.4, sg: -112.1, dl: 32.8, dg: -96.8,  sn: 'Phoenix',     dn: 'Dallas',          type: 'regular', carrier: 'Werner'       },
  { sl: 47.6, sg: -122.3, dl: 34.0, dg: -118.2, sn: 'Seattle',     dn: 'Los Angeles',     type: 'regular', carrier: 'Schneider'    },
  { sl: 39.7, sg: -104.9, dl: 34.0, dg: -118.2, sn: 'Denver',      dn: 'Los Angeles',     type: 'regular', carrier: 'XPO'          },
  { sl: 39.1, sg: -94.6,  dl: 39.7, dg: -104.9, sn: 'Kansas City', dn: 'Denver',          type: 'regular', carrier: 'JB Hunt'      },
  { sl: 40.7, sg: -74.0,  dl: 42.4, dg: -71.1,  sn: 'New York',    dn: 'Boston',          type: 'regular', carrier: 'Old Dominion' },
  { sl: 42.3, sg: -83.1,  dl: 41.9, dg: -87.6,  sn: 'Detroit',     dn: 'Chicago',         type: 'regular', carrier: 'XPO'          },
  { sl: 42.3, sg: -83.1,  dl: 40.7, dg: -74.0,  sn: 'Detroit',     dn: 'New York',        type: 'regular', carrier: 'JB Hunt'      },
  { sl: 40.7, sg: -74.0,  dl: 39.0, dg: -76.6,  sn: 'New York',    dn: 'Baltimore',       type: 'regular', carrier: 'Old Dominion' },
  { sl: 36.2, sg: -115.2, dl: 34.0, dg: -118.2, sn: 'Las Vegas',   dn: 'Los Angeles',     type: 'regular', carrier: 'Werner'       },
  { sl: 29.8, sg: -95.4,  dl: 30.3, dg: -97.7,  sn: 'Houston',     dn: 'Austin',          type: 'tank',    carrier: 'Schneider'    },
  // ── US–Mexico NAFTA ──
  { sl: 27.5, sg: -99.5,  dl: 19.4, dg: -99.1,  sn: 'Laredo',      dn: 'Mexico City',     type: 'regular', carrier: 'XPO'          },
  { sl: 31.8, sg: -106.4, dl: 25.7, dg: -100.3, sn: 'El Paso',     dn: 'Monterrey',       type: 'regular', carrier: 'DB Schenker'  },
  { sl: 32.5, sg: -117.0, dl: 20.7, dg: -103.3, sn: 'Tijuana',     dn: 'Guadalajara',     type: 'tank',    carrier: 'Werner'       },
  { sl: 32.8, sg: -96.8,  dl: 27.5, dg: -99.5,  sn: 'Dallas',      dn: 'Laredo',          type: 'regular', carrier: 'JB Hunt'      },
  { sl: 29.8, sg: -95.4,  dl: 27.5, dg: -99.5,  sn: 'Houston',     dn: 'Laredo',          type: 'tank',    carrier: 'Schneider'    },
  // ── US–Canada ──
  { sl: 42.3, sg: -83.1,  dl: 43.7, dg: -79.4,  sn: 'Detroit',     dn: 'Toronto',         type: 'regular', carrier: 'XPO'          },
  { sl: 47.6, sg: -122.3, dl: 49.3, dg: -123.1, sn: 'Seattle',     dn: 'Vancouver',       type: 'regular', carrier: 'JB Hunt'      },
  { sl: 43.7, sg: -79.4,  dl: 45.5, dg: -73.6,  sn: 'Toronto',     dn: 'Montreal',        type: 'regular', carrier: 'DB Schenker'  },
  { sl: 49.3, sg: -123.1, dl: 51.0, dg: -114.1, sn: 'Vancouver',   dn: 'Calgary',         type: 'regular', carrier: 'Werner'       },
  { sl: 51.0, sg: -114.1, dl: 53.5, dg: -113.5, sn: 'Calgary',     dn: 'Edmonton',        type: 'tank',    carrier: 'Schneider'    },
  // ── South America ──
  { sl: -23.5,sg: -46.6,  dl: -34.6,dg: -58.4,  sn: 'São Paulo',   dn: 'Buenos Aires',    type: 'regular', carrier: 'DHL Freight'  },
  { sl: -23.5,sg: -46.6,  dl: -19.9,dg: -43.9,  sn: 'São Paulo',   dn: 'Belo Horizonte',  type: 'regular', carrier: 'DHL Freight'  },
  { sl: -12.0,sg: -77.0,  dl: -33.5,dg: -70.6,  sn: 'Lima',        dn: 'Santiago',        type: 'tank',    carrier: 'DB Schenker'  },
  // ── Europe ──
  { sl: 51.5, sg: -0.1,   dl: 48.9, dg: 2.3,    sn: 'London',      dn: 'Paris',           type: 'regular', carrier: 'DB Schenker'  },
  { sl: 48.9, sg: 2.3,    dl: 50.8, dg: 4.4,    sn: 'Paris',       dn: 'Brussels',        type: 'regular', carrier: 'DHL Freight'  },
  { sl: 50.8, sg: 4.4,    dl: 52.4, dg: 4.9,    sn: 'Brussels',    dn: 'Amsterdam',       type: 'regular', carrier: 'DB Schenker'  },
  { sl: 52.4, sg: 4.9,    dl: 53.6, dg: 10.0,   sn: 'Amsterdam',   dn: 'Hamburg',         type: 'regular', carrier: 'XPO'          },
  { sl: 53.6, sg: 10.0,   dl: 52.5, dg: 13.4,   sn: 'Hamburg',     dn: 'Berlin',          type: 'regular', carrier: 'DB Schenker'  },
  { sl: 52.5, sg: 13.4,   dl: 52.2, dg: 21.0,   sn: 'Berlin',      dn: 'Warsaw',          type: 'regular', carrier: 'DHL Freight'  },
  { sl: 52.2, sg: 21.0,   dl: 50.5, dg: 30.5,   sn: 'Warsaw',      dn: 'Kyiv',            type: 'regular', carrier: 'DB Schenker'  },
  { sl: 48.9, sg: 2.3,    dl: 45.7, dg: 4.8,    sn: 'Paris',       dn: 'Lyon',            type: 'regular', carrier: 'XPO'          },
  { sl: 45.7, sg: 4.8,    dl: 45.5, dg: 9.2,    sn: 'Lyon',        dn: 'Milan',           type: 'regular', carrier: 'DHL Freight'  },
  { sl: 45.5, sg: 9.2,    dl: 41.9, dg: 12.5,   sn: 'Milan',       dn: 'Rome',            type: 'regular', carrier: 'DB Schenker'  },
  { sl: 53.6, sg: 10.0,   dl: 48.1, dg: 11.6,   sn: 'Hamburg',     dn: 'Munich',          type: 'regular', carrier: 'DHL Freight'  },
  { sl: 48.1, sg: 11.6,   dl: 48.2, dg: 16.4,   sn: 'Munich',      dn: 'Vienna',          type: 'regular', carrier: 'DB Schenker'  },
  { sl: 48.2, sg: 16.4,   dl: 47.5, dg: 19.1,   sn: 'Vienna',      dn: 'Budapest',        type: 'regular', carrier: 'XPO'          },
  { sl: 47.5, sg: 19.1,   dl: 44.4, dg: 26.1,   sn: 'Budapest',    dn: 'Bucharest',       type: 'regular', carrier: 'DHL Freight'  },
  { sl: 50.1, sg: 8.7,    dl: 48.9, dg: 2.3,    sn: 'Frankfurt',   dn: 'Paris',           type: 'regular', carrier: 'DB Schenker'  },
  { sl: 41.4, sg: 2.2,    dl: 40.4, dg: -3.7,   sn: 'Barcelona',   dn: 'Madrid',          type: 'regular', carrier: 'DHL Freight'  },
  { sl: 40.4, sg: -3.7,   dl: 38.7, dg: -9.1,   sn: 'Madrid',      dn: 'Lisbon',          type: 'regular', carrier: 'DB Schenker'  },
  { sl: 51.9, sg: 4.5,    dl: 50.1, dg: 8.7,    sn: 'Rotterdam',   dn: 'Frankfurt',       type: 'tank',    carrier: 'DHL Freight'  },
  { sl: 59.3, sg: 18.1,   dl: 59.9, dg: 10.7,   sn: 'Stockholm',   dn: 'Oslo',            type: 'regular', carrier: 'DB Schenker'  },
  { sl: 60.2, sg: 24.9,   dl: 59.3, dg: 18.1,   sn: 'Helsinki',    dn: 'Stockholm',       type: 'regular', carrier: 'DHL Freight'  },
  // ── Turkey / Middle East ──
  { sl: 41.0, sg: 28.9,   dl: 39.9, dg: 32.9,   sn: 'Istanbul',    dn: 'Ankara',          type: 'regular', carrier: 'DB Schenker'  },
  { sl: 39.9, sg: 32.9,   dl: 35.7, dg: 51.4,   sn: 'Ankara',      dn: 'Tehran',          type: 'tank',    carrier: 'DHL Freight'  },
  { sl: 35.7, sg: 51.4,   dl: 25.2, dg: 55.3,   sn: 'Tehran',      dn: 'Dubai',           type: 'tank',    carrier: 'DB Schenker'  },
  { sl: 25.2, sg: 55.3,   dl: 24.7, dg: 46.7,   sn: 'Dubai',       dn: 'Riyadh',          type: 'tank',    carrier: 'XPO'          },
  { sl: 25.2, sg: 55.3,   dl: 23.6, dg: 58.6,   sn: 'Dubai',       dn: 'Muscat',          type: 'regular', carrier: 'DHL Freight'  },
  { sl: 30.1, sg: 31.2,   dl: 31.2, dg: 29.9,   sn: 'Cairo',       dn: 'Alexandria',      type: 'regular', carrier: 'DB Schenker'  },
  // ── China ──
  { sl: 31.2, sg: 121.5,  dl: 39.9, dg: 116.4,  sn: 'Shanghai',    dn: 'Beijing',         type: 'regular', carrier: 'DHL Freight'  },
  { sl: 39.9, sg: 116.4,  dl: 23.1, dg: 113.3,  sn: 'Beijing',     dn: 'Guangzhou',       type: 'regular', carrier: 'DB Schenker'  },
  { sl: 30.6, sg: 104.1,  dl: 29.6, dg: 106.5,  sn: 'Chengdu',     dn: 'Chongqing',       type: 'regular', carrier: 'DHL Freight'  },
  { sl: 39.9, sg: 116.4,  dl: 34.3, dg: 108.9,  sn: 'Beijing',     dn: "Xi'an",           type: 'regular', carrier: 'DB Schenker'  },
  { sl: 34.3, sg: 108.9,  dl: 30.6, dg: 104.1,  sn: "Xi'an",       dn: 'Chengdu',         type: 'regular', carrier: 'DHL Freight'  },
  { sl: 34.3, sg: 108.9,  dl: 39.5, dg: 76.0,   sn: "Xi'an",       dn: 'Kashgar',         type: 'regular', carrier: 'DB Schenker'  },
  { sl: 39.5, sg: 76.0,   dl: 43.3, dg: 76.9,   sn: 'Kashgar',     dn: 'Almaty',          type: 'regular', carrier: 'DHL Freight'  },
  { sl: 43.3, sg: 76.9,   dl: 55.8, dg: 37.6,   sn: 'Almaty',      dn: 'Moscow',          type: 'regular', carrier: 'DB Schenker'  },
  // ── Russia ──
  { sl: 55.8, sg: 37.6,   dl: 52.2, dg: 21.0,   sn: 'Moscow',      dn: 'Warsaw',          type: 'regular', carrier: 'DHL Freight'  },
  { sl: 55.8, sg: 37.6,   dl: 59.9, dg: 30.3,   sn: 'Moscow',      dn: 'St. Petersburg',  type: 'regular', carrier: 'DB Schenker'  },
  // ── India ──
  { sl: 28.6, sg: 77.2,   dl: 19.1, dg: 72.9,   sn: 'Delhi',       dn: 'Mumbai',          type: 'regular', carrier: 'DHL Freight'  },
  { sl: 28.6, sg: 77.2,   dl: 22.6, dg: 88.4,   sn: 'Delhi',       dn: 'Kolkata',         type: 'regular', carrier: 'DB Schenker'  },
  { sl: 19.1, sg: 72.9,   dl: 12.9, dg: 77.6,   sn: 'Mumbai',      dn: 'Bangalore',       type: 'regular', carrier: 'DHL Freight'  },
  { sl: 12.9, sg: 77.6,   dl: 13.1, dg: 80.3,   sn: 'Bangalore',   dn: 'Chennai',         type: 'regular', carrier: 'XPO'          },
  // ── SE Asia ──
  { sl: 13.8, sg: 100.5,  dl: 3.1,  dg: 101.7,  sn: 'Bangkok',     dn: 'Kuala Lumpur',    type: 'regular', carrier: 'DHL Freight'  },
  { sl: 3.1,  sg: 101.7,  dl: 1.4,  dg: 103.8,  sn: 'Kuala Lumpur',dn: 'Singapore',       type: 'regular', carrier: 'DB Schenker'  },
  { sl: 10.8, sg: 106.7,  dl: 11.6, dg: 104.9,  sn: 'Ho Chi Minh', dn: 'Phnom Penh',      type: 'regular', carrier: 'DHL Freight'  },
  // ── Australia ──
  { sl: -33.9,sg: 151.2,  dl: -37.8,dg: 144.9,  sn: 'Sydney',      dn: 'Melbourne',       type: 'regular', carrier: 'DB Schenker'  },
  { sl: -37.8,sg: 144.9,  dl: -34.9,dg: 138.6,  sn: 'Melbourne',   dn: 'Adelaide',        type: 'regular', carrier: 'DHL Freight'  },
  // ── Africa ──
  { sl: -26.2,sg: 28.0,   dl: -29.9,dg: 31.0,   sn: 'Johannesburg',dn: 'Durban',          type: 'tank',    carrier: 'DB Schenker'  },
  { sl: 6.5,  sg: 3.4,    dl: 9.1,  dg: 7.2,    sn: 'Lagos',       dn: 'Abuja',           type: 'regular', carrier: 'DHL Freight'  },
  { sl: -1.3, sg: 36.8,   dl: -4.1, dg: 39.7,   sn: 'Nairobi',     dn: 'Mombasa',         type: 'regular', carrier: 'DB Schenker'  },
];

function buildSimulatedTrucks() {
  function gcTruckPoint(lat1d, lng1d, lat2d, lng2d, t) {
    const R = Math.PI / 180;
    const lat1 = lat1d * R, lng1 = lng1d * R, lat2 = lat2d * R, lng2 = lng2d * R;
    const cosDelta = Math.sin(lat1)*Math.sin(lat2) + Math.cos(lat1)*Math.cos(lat2)*Math.cos(lng2-lng1);
    const delta = Math.acos(Math.max(-1, Math.min(1, cosDelta)));
    if (delta < 1e-8) return { lat: lat1d, lng: lng1d, heading: 0 };
    const sinD = Math.sin(delta);
    const A = Math.sin((1-t)*delta)/sinD, B = Math.sin(t*delta)/sinD;
    const x = A*Math.cos(lat1)*Math.cos(lng1) + B*Math.cos(lat2)*Math.cos(lng2);
    const y = A*Math.cos(lat1)*Math.sin(lng1) + B*Math.cos(lat2)*Math.sin(lng2);
    const z = A*Math.sin(lat1)                + B*Math.sin(lat2);
    const lat = Math.atan2(z, Math.sqrt(x*x+y*y));
    const lng = Math.atan2(y, x);
    const t2 = Math.min(t + 0.001, 1);
    const A2=Math.sin((1-t2)*delta)/sinD, B2=Math.sin(t2*delta)/sinD;
    const x2=A2*Math.cos(lat1)*Math.cos(lng1)+B2*Math.cos(lat2)*Math.cos(lng2);
    const y2=A2*Math.cos(lat1)*Math.sin(lng1)+B2*Math.cos(lat2)*Math.sin(lng2);
    const z2=A2*Math.sin(lat1)+B2*Math.sin(lat2);
    const lat2r=Math.atan2(z2,Math.sqrt(x2*x2+y2*y2)), lng2r=Math.atan2(y2,x2);
    const heading = (Math.atan2(lng2r-lng, lat2r-lat) * 180 / Math.PI + 360) % 360;
    return { lat: lat/R, lng: lng/R, heading };
  }

  const trucks = [];
  let id = 0;
  TRUCK_LANES.forEach((lane, laneIdx) => {
    for (let i = 0; i < 4; i++) {
      const seed = laneIdx * 1000 + i;
      const phase = (seed * 2654435761) % 86400;
      const progress = ((Date.now() / 1000 + phase) % 86400) / 86400;
      const pos = gcTruckPoint(lane.sl, lane.sg, lane.dl, lane.dg, progress);
      const velocity = lane.type === 'tank' ? 50 + (seed % 15) : 60 + (seed % 15);
      id++;
      trucks.push({
        id: `TRK${String(id).padStart(4, '0')}`,
        callsign: `${lane.carrier.split(' ')[0].toUpperCase().slice(0, 4)}-${String(seed % 9999).padStart(4, '0')}`,
        carrier: lane.carrier,
        type: lane.type,
        srcLat: lane.sl, srcLng: lane.sg,
        dstLat: lane.dl, dstLng: lane.dg,
        origin: lane.sn, destination: lane.dn,
        progress,
        lat: pos.lat, lng: pos.lng, heading: pos.heading,
        velocity,
      });
    }
  });
  return trucks;
}

app.get('/api/trucks', (req, res) => {
  res.json({ trucks: buildSimulatedTrucks(), source: 'simulated' });
});
```

**Step 2: Verify the endpoint works**

Start backend: `cd backend && node server.js`
Then: `curl http://localhost:5001/api/trucks | python3 -m json.tool | head -40`

Expected: JSON with `trucks` array containing objects like:
```json
{
  "id": "TRK0001",
  "callsign": "JB H-0000",
  "carrier": "JB Hunt",
  "type": "regular",
  "srcLat": 34.0, "srcLng": -118.2,
  "dstLat": 40.7, "dstLng": -74.0,
  "origin": "Los Angeles", "destination": "New York",
  "progress": 0.42,
  "lat": 37.1, "lng": -96.8,
  "heading": 65.2,
  "velocity": 72
}
```
Also verify: `curl http://localhost:5001/api/trucks | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d['trucks']))"` — should print 316.

**Step 3: Commit**

```bash
git add backend/server.js
git commit -m "feat: add /api/trucks — 316 simulated trucks on 79 global highway corridors"
```

---

## Task 2: LandFreightPage.css

**Files:**
- Create: `frontend/src/pages/LandFreightPage.css`

**Step 1: Create the CSS file**

This mirrors `FlightsPage.css` exactly, with `fg-` replaced by `lg-`, and the accent color changed from `#00d4ff` to `#facc15` (yellow). Create `frontend/src/pages/LandFreightPage.css`:

```css
/* frontend/src/pages/LandFreightPage.css */
.lg-page { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; background: #060b18; }

/* Header */
.lg-header {
  display: flex; align-items: center; gap: 10px; padding: 10px 18px;
  border-bottom: 1px solid rgba(250,204,21,0.1); flex-shrink: 0;
  background: rgba(6,11,24,0.95);
}
.lg-header-icon { color: #facc15; }
.lg-header-title { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #e2e8f0; letter-spacing: 0.12em; font-weight: 700; }
.lg-truck-count { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #334155; }
.lg-refresh-btn { background: none; border: none; color: #334155; cursor: pointer; padding: 4px; transition: color 0.15s; }
.lg-refresh-btn:hover { color: #facc15; }
@keyframes lg-spin { to { transform: rotate(360deg); } }
.lg-spin { animation: lg-spin 1s linear infinite; }
.lg-border-badges { display: flex; gap: 5px; margin-left: auto; }
.lg-bz-badge {
  font-family: 'JetBrains Mono', monospace; font-size: 8px; letter-spacing: 0.08em;
  padding: 2px 7px; border-radius: 3px; font-weight: 700;
}
.lg-bz-badge.red   { background: rgba(239,68,68,0.1);   color: #ef4444; border: 1px solid rgba(239,68,68,0.25);   }
.lg-bz-badge.amber { background: rgba(245,158,11,0.1);  color: #f59e0b; border: 1px solid rgba(245,158,11,0.25);  }
.lg-bz-badge.green { background: rgba(16,185,129,0.1);  color: #10b981; border: 1px solid rgba(16,185,129,0.25);  }

/* Body */
.lg-body { display: flex; flex: 1; min-height: 0; overflow: hidden; }
.lg-globe-wrap { flex: 1; min-width: 0; position: relative; overflow: hidden; background: #020608; }

/* Scanline overlay */
.lg-scanline {
  position: absolute; inset: 0; pointer-events: none; z-index: 2;
  background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px);
}

/* Legend */
.lg-legend {
  position: absolute; bottom: 14px; left: 14px; z-index: 10;
  display: flex; flex-direction: column; gap: 4px;
  background: rgba(6,11,24,0.88); border: 1px solid rgba(255,255,255,0.07);
  border-radius: 8px; padding: 10px 14px; font-size: 11px;
  backdrop-filter: blur(8px);
}
.lg-legend span { color: #94a3b8; letter-spacing: 0.03em; }

/* Right panel */
.lg-panel {
  width: 310px; flex-shrink: 0; border-left: 1px solid rgba(250,204,21,0.08);
  display: flex; flex-direction: column; overflow-y: auto;
  background: rgba(6,11,24,0.97);
}

/* Fleet overview */
.lg-stats { padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.05); }
.lg-stats-label { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: #475569; letter-spacing: 0.12em; margin-bottom: 10px; }
.lg-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.lg-stat { display: flex; flex-direction: column; align-items: center; gap: 3px; }
.lg-stat-val { font-family: 'JetBrains Mono', monospace; font-size: 18px; font-weight: 700; line-height: 1; }
.lg-stat-key { font-family: 'JetBrains Mono', monospace; font-size: 8px; color: #475569; letter-spacing: 0.08em; }
.lg-speed-strip { display: flex; align-items: center; gap: 6px; margin-top: 10px; color: #475569; font-family: 'JetBrains Mono', monospace; font-size: 9px; }

/* Carrier watch */
.lg-carriers { padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.05); }
.lg-section-label { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: #475569; letter-spacing: 0.12em; margin-bottom: 10px; }
.lg-carrier-row { display: flex; align-items: center; gap: 7px; margin-bottom: 7px; }
.lg-carrier-code { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: #facc15; font-weight: 700; min-width: 40px; }
.lg-carrier-name { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: #64748b; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lg-carrier-bar { width: 52px; height: 4px; background: rgba(255,255,255,0.06); border-radius: 2px; flex-shrink: 0; }
.lg-carrier-fill { height: 100%; background: rgba(250,204,21,0.5); border-radius: 2px; transition: width 0.4s; }
.lg-carrier-count { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: #475569; min-width: 22px; text-align: right; }

/* Hot corridors */
.lg-corridors { padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.05); }
.lg-corridor-row { display: flex; align-items: center; gap: 7px; margin-bottom: 6px; }
.lg-corridor-rank { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: #475569; min-width: 22px; }
.lg-corridor-name { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: #94a3b8; flex: 1; }
.lg-corridor-count { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: #a3e635; white-space: nowrap; }

/* Event feed */
.lg-feed { padding: 14px 16px; flex: 1; display: flex; flex-direction: column; min-height: 0; }
.lg-feed-label { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: #475569; letter-spacing: 0.12em; margin-bottom: 10px; display: flex; align-items: center; gap: 7px; }
.lg-feed-pulse { width: 6px; height: 6px; border-radius: 50%; background: #facc15; box-shadow: 0 0 6px rgba(250,204,21,0.6); animation: lg-pulse 1.5s ease-in-out infinite; }
@keyframes lg-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
.lg-feed-clear { margin-left: auto; font-family: 'JetBrains Mono', monospace; font-size: 8px; background: none; border: 1px solid rgba(255,255,255,0.08); color: #475569; cursor: pointer; padding: 2px 7px; border-radius: 3px; letter-spacing: 0.06em; }
.lg-feed-clear:hover { color: #facc15; border-color: rgba(250,204,21,0.2); }
.lg-feed-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
.lg-feed-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 5px; padding: 8px 10px; }
.lg-feed-card-clickable { cursor: pointer; transition: background 0.15s, border-color 0.15s; }
.lg-feed-card-clickable:hover { background: rgba(250,204,21,0.05); border-color: rgba(250,204,21,0.15); }
.lg-feed-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 3px; }
.lg-feed-callsign { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #facc15; font-weight: 700; }
.lg-feed-warn { display: flex; align-items: center; gap: 3px; font-family: 'JetBrains Mono', monospace; font-size: 8px; color: #f59e0b; }
.lg-feed-card-detail { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: #64748b; }
.lg-feed-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: #334155; height: 80px; font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.06em; }

/* Truck detail */
.lg-truck-detail { display: flex; flex-direction: column; gap: 2px; }
.lg-td-name { font-family: 'JetBrains Mono', monospace; font-size: 15px; color: #facc15; font-weight: 700; margin-bottom: 10px; }
.lg-td-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,0.04); font-family: 'JetBrains Mono', monospace; font-size: 10px; }
.lg-td-row span:first-child { color: #475569; }
.lg-td-row span:last-child { color: #e2e8f0; }
```

**Step 2: Verify it looks correct**

Open the file and confirm it has 90+ lines and all class names start with `lg-`.

**Step 3: Commit**

```bash
git add frontend/src/pages/LandFreightPage.css
git commit -m "feat: LandFreightPage CSS — lg- prefix, yellow accent"
```

---

## Task 3: LGPanel.jsx (right-side intelligence panel)

**Files:**
- Create: `frontend/src/components/LGPanel.jsx`

**Step 1: Create LGPanel.jsx**

This mirrors `FGPanel.jsx`. Key differences: uses `carrier` field directly (not callsign prefix), uses `type` field (`'regular'` or `'tank'`) instead of `isCargo`, speed is in mph not kts.

```jsx
// frontend/src/components/LGPanel.jsx
import { useState, useEffect, useRef, useMemo } from 'react';
import { RiTruckLine, RiAlertLine, RiRadarLine } from 'react-icons/ri';

const CARRIER_DISPLAY = {
  'JB Hunt':      'JB Hunt Transport',
  'Werner':       'Werner Enterprises',
  'Schneider':    'Schneider National',
  'XPO':          'XPO Logistics',
  'Old Dominion': 'Old Dominion Freight',
  'DB Schenker':  'DB Schenker',
  'DHL Freight':  'DHL Freight',
};

const HUB_CHECKS = [
  { name: 'Memphis',     lat: 35.04, lng: -90.00 },
  { name: 'Louisville',  lat: 38.17, lng: -85.74 },
  { name: 'Chicago',     lat: 41.97, lng: -87.91 },
  { name: 'Dallas',      lat: 32.90, lng: -97.04 },
  { name: 'Los Angeles', lat: 34.05, lng: -118.24 },
  { name: 'Rotterdam',   lat: 51.95, lng: 4.13   },
  { name: 'Frankfurt',   lat: 50.10, lng: 8.68   },
  { name: 'Dubai',       lat: 25.20, lng: 55.27  },
];

const BORDER_CHECKS = [
  { name: 'Laredo',       lat: 27.5,  lng: -99.5  },
  { name: 'Dover/Calais', lat: 51.1,  lng: 1.8    },
  { name: 'Khorgos',      lat: 44.2,  lng: 80.2   },
];

function dist(a, b) {
  return Math.sqrt((a.lat - b.lat) ** 2 + (a.lng - b.lng) ** 2);
}

function generateTruckEvent(truck) {
  if (!truck) return null;
  const spd = truck.velocity || 0;
  const nearHub = HUB_CHECKS.find(h => dist(h, { lat: truck.lat, lng: truck.lng }) < 3.5);
  if (nearHub) return { name: truck.callsign, detail: `Approaching ${nearHub.name} hub`, spd, warn: false, id: truck.id, ts: Date.now() };
  const nearBorder = BORDER_CHECKS.find(h => dist(h, { lat: truck.lat, lng: truck.lng }) < 5);
  if (nearBorder) return { name: truck.callsign, detail: `Border crossing: ${nearBorder.name}`, spd, warn: false, id: truck.id, ts: Date.now() };
  return {
    name: truck.callsign,
    detail: truck.destination ? `${truck.origin || '—'} \u2192 ${truck.destination}` : 'In transit',
    spd, warn: false, id: truck.id, ts: Date.now(),
  };
}

function LGStats({ trucks }) {
  const regular = trucks.filter(t => t.type === 'regular').length;
  const tank    = trucks.filter(t => t.type === 'tank').length;
  const avgSpd  = trucks.length
    ? Math.round(trucks.reduce((s, t) => s + (t.velocity || 0), 0) / trucks.length)
    : 0;
  return (
    <div className="lg-stats">
      <div className="lg-stats-label">FLEET OVERVIEW</div>
      <div className="lg-stats-grid">
        <div className="lg-stat"><span className="lg-stat-val" style={{ color: '#94a3b8' }}>{trucks.length}</span><span className="lg-stat-key">TOTAL</span></div>
        <div className="lg-stat"><span className="lg-stat-val" style={{ color: '#facc15' }}>{regular}</span><span className="lg-stat-key">REGULAR</span></div>
        <div className="lg-stat"><span className="lg-stat-val" style={{ color: '#a3e635' }}>{tank}</span><span className="lg-stat-key">TANK</span></div>
        <div className="lg-stat"><span className="lg-stat-val" style={{ color: '#10b981', fontSize: 13 }}>{avgSpd || '\u2014'}</span><span className="lg-stat-key">AVG MPH</span></div>
      </div>
      {avgSpd > 0 && (
        <div className="lg-speed-strip">
          <RiTruckLine size={10} />
          <span>Avg speed {avgSpd} mph &middot; {Math.round(avgSpd * 1.609)} km/h</span>
        </div>
      )}
    </div>
  );
}

function LGCarrierWatch({ trucks }) {
  const carriers = useMemo(() => {
    const map = {};
    trucks.forEach(t => { map[t.carrier] = (map[t.carrier] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [trucks]);
  const max = carriers[0]?.[1] || 1;
  if (!carriers.length) return null;
  return (
    <div className="lg-carriers">
      <div className="lg-section-label">CARRIER WATCH</div>
      {carriers.map(([name, count]) => (
        <div key={name} className="lg-carrier-row">
          <span className="lg-carrier-code">{name.split(' ')[0].slice(0, 5)}</span>
          <span className="lg-carrier-name">{CARRIER_DISPLAY[name] || name}</span>
          <div className="lg-carrier-bar">
            <div className="lg-carrier-fill" style={{ width: `${(count / max) * 100}%` }} />
          </div>
          <span className="lg-carrier-count">{count}</span>
        </div>
      ))}
    </div>
  );
}

function LGHotCorridors({ trucks }) {
  const corridors = useMemo(() => {
    const map = {};
    trucks.forEach(t => {
      if (t.origin && t.destination) {
        const key = `${t.origin} \u2192 ${t.destination}`;
        map[key] = (map[key] || 0) + 1;
      }
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [trucks]);
  if (!corridors.length) return null;
  return (
    <div className="lg-corridors">
      <div className="lg-section-label">HOT CORRIDORS</div>
      {corridors.map(([lane, count], i) => (
        <div key={lane} className="lg-corridor-row">
          <span className="lg-corridor-rank">#{i + 1}</span>
          <span className="lg-corridor-name">{lane}</span>
          <span className="lg-corridor-count">{count} trucks</span>
        </div>
      ))}
    </div>
  );
}

function LGEventFeed({ trucks, selectedTruck, onClear, onFeedTruckClick }) {
  const [events, setEvents] = useState([]);
  const timerRef  = useRef(null);
  const trucksRef = useRef(trucks);
  useEffect(() => { trucksRef.current = trucks; }, [trucks]);

  useEffect(() => {
    if (!trucksRef.current.length) return;
    const push = () => {
      if (selectedTruck) return;
      const arr = trucksRef.current;
      const t   = arr[Math.floor(Math.random() * arr.length)];
      const ev  = generateTruckEvent(t);
      if (!ev) return;
      setEvents(prev => [ev, ...prev].slice(0, 8));
    };
    push();
    timerRef.current = setInterval(push, 3500);
    return () => clearInterval(timerRef.current);
  }, [selectedTruck]);

  if (selectedTruck) {
    return (
      <div className="lg-feed">
        <div className="lg-feed-label">
          VEHICLE DETAIL
          <button className="lg-feed-clear" onClick={onClear}>CLOSE</button>
        </div>
        <div className="lg-truck-detail">
          <div className="lg-td-name">{selectedTruck.callsign}</div>
          <div className="lg-td-row"><span>Carrier</span><span>{selectedTruck.carrier}</span></div>
          <div className="lg-td-row"><span>Type</span><span>{selectedTruck.type === 'tank' ? 'Tank Truck' : 'Regular Truck'}</span></div>
          <div className="lg-td-row"><span>Speed</span><span>{selectedTruck.velocity || '\u2014'} mph</span></div>
          <div className="lg-td-row"><span>Heading</span><span>{selectedTruck.heading?.toFixed(0) ?? '\u2014'}{selectedTruck.heading != null ? '\u00b0' : ''}</span></div>
          <div className="lg-td-row"><span>Origin</span><span>{selectedTruck.origin || '\u2014'}</span></div>
          <div className="lg-td-row"><span>Destination</span><span>{selectedTruck.destination || '\u2014'}</span></div>
          <div className="lg-td-row"><span>Progress</span><span>{selectedTruck.progress != null ? `${Math.round(selectedTruck.progress * 100)}%` : '\u2014'}</span></div>
        </div>
      </div>
    );
  }

  return (
    <div className="lg-feed">
      <div className="lg-feed-label">
        LIVE EVENT FEED
        <span className="lg-feed-pulse" />
      </div>
      <div className="lg-feed-list">
        {events.map((ev, i) => {
          const truck = ev.id ? trucks.find(t => t.id === ev.id) : null;
          return (
            <div
              key={ev.ts + i}
              className={`lg-feed-card${truck ? ' lg-feed-card-clickable' : ''}`}
              onClick={() => truck && onFeedTruckClick?.(truck)}
            >
              <div className="lg-feed-card-top">
                <span className="lg-feed-callsign">{ev.name}</span>
                {ev.warn && <span className="lg-feed-warn"><RiAlertLine size={9} /> WARN</span>}
              </div>
              <div className="lg-feed-card-detail">{ev.detail} &middot; {ev.spd} mph</div>
            </div>
          );
        })}
        {events.length === 0 && (
          <div className="lg-feed-empty">
            <RiRadarLine size={22} />
            <span>Scanning...</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LGPanel({ trucks, selectedTruck, onClearTruck, onFeedTruckClick }) {
  return (
    <div className="lg-panel">
      <LGStats trucks={trucks} />
      <LGCarrierWatch trucks={trucks} />
      <LGHotCorridors trucks={trucks} />
      <LGEventFeed
        trucks={trucks}
        selectedTruck={selectedTruck}
        onClear={onClearTruck}
        onFeedTruckClick={onFeedTruckClick}
      />
    </div>
  );
}
```

**Step 2: Verify it parses**

```bash
cd frontend && node --input-type=module --eval "import './src/components/LGPanel.jsx'" 2>&1 | head -5
```
Expected: no output (no errors). If there is an error, it will show you the line.

**Step 3: Commit**

```bash
git add frontend/src/components/LGPanel.jsx
git commit -m "feat: LGPanel — Fleet Overview, Carrier Watch, Hot Corridors, Event Feed"
```

---

## Task 4: LandGlobe.jsx (Three.js globe component)

**Files:**
- Create: `frontend/src/components/LandGlobe.jsx`

**Step 1: Create LandGlobe.jsx**

This mirrors `FlightsGlobe.jsx`. Key differences: topology texture, yellow/lime truck sprites (canvas-drawn top-down truck silhouettes), border crossing rings instead of airspace zones, hub labels for distribution centers.

```jsx
// frontend/src/components/LandGlobe.jsx
import { useEffect, useRef, useCallback, useMemo } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';

const REGULAR_COLOR = 'rgba(250,204,21,0.9)';   // #facc15 bright yellow
const TANK_COLOR    = 'rgba(163,230,53,0.9)';    // #a3e635 lime
const REGULAR_DIM   = 'rgba(250,204,21,0.05)';
const TANK_DIM      = 'rgba(163,230,53,0.05)';

const HOME_POV = { lat: 30, lng: 0, altitude: 2.2 };

const DISTRIBUTION_HUBS = [
  { code: 'MEM', name: 'Memphis',       lat: 35.04,  lng: -90.00  },
  { code: 'SDF', name: 'Louisville',    lat: 38.17,  lng: -85.74  },
  { code: 'ORD', name: 'Chicago',       lat: 41.97,  lng: -87.91  },
  { code: 'DFW', name: 'Dallas',        lat: 32.90,  lng: -97.04  },
  { code: 'LAX', name: 'Los Angeles',   lat: 34.05,  lng: -118.24 },
  { code: 'RTM', name: 'Rotterdam',     lat: 51.95,  lng: 4.13    },
  { code: 'FRA', name: 'Frankfurt',     lat: 50.10,  lng: 8.68    },
  { code: 'DXB', name: 'Dubai',         lat: 25.20,  lng: 55.27   },
  { code: 'CTU', name: 'Chengdu',       lat: 30.57,  lng: 104.07  },
  { code: 'SIN', name: 'Singapore',     lat: 1.35,   lng: 103.82  },
  { code: 'GRU', name: 'São Paulo',     lat: -23.55, lng: -46.63  },
];

const BORDER_CROSSINGS = [
  { name: 'Laredo / Nuevo Laredo', lat: 27.5,  lng: -99.5, color: '#10b981', maxRadius: 3.5, propagationSpeed: 2,   repeatPeriod: 800  },
  { name: 'Dover / Calais',        lat: 51.1,  lng: 1.8,   color: '#f59e0b', maxRadius: 3,   propagationSpeed: 1.8, repeatPeriod: 1000 },
  { name: 'Brest-Terespol',        lat: 52.1,  lng: 23.7,  color: '#ef4444', maxRadius: 4,   propagationSpeed: 2.5, repeatPeriod: 700  },
  { name: 'Khorgos (CN-KZ)',       lat: 44.2,  lng: 80.2,  color: '#f59e0b', maxRadius: 3,   propagationSpeed: 1.5, repeatPeriod: 1100 },
  { name: 'Wagah (IN-PK)',         lat: 31.6,  lng: 74.6,  color: '#ef4444', maxRadius: 3.5, propagationSpeed: 2,   repeatPeriod: 750  },
];

function truckColor(type) { return type === 'tank' ? TANK_COLOR : REGULAR_COLOR; }
function truckDim(type)   { return type === 'tank' ? TANK_DIM   : REGULAR_DIM;   }

function portStatusColor(status) {
  if (status === 'disruption') return '#ef4444';
  if (status === 'congestion') return '#f59e0b';
  return '#10b981';
}

// Great-circle SLERP — identical to FlightsGlobe
function gcPoint(lat1d, lng1d, lat2d, lng2d, t) {
  const R = Math.PI / 180;
  const lat1 = lat1d*R, lng1 = lng1d*R, lat2 = lat2d*R, lng2 = lng2d*R;
  const cosDelta = Math.sin(lat1)*Math.sin(lat2) + Math.cos(lat1)*Math.cos(lat2)*Math.cos(lng2-lng1);
  const delta = Math.acos(Math.max(-1, Math.min(1, cosDelta)));
  if (delta < 1e-8) return { lat: lat1d, lng: lng1d, heading: 0 };
  const sinD = Math.sin(delta);
  const A = Math.sin((1-t)*delta)/sinD, B = Math.sin(t*delta)/sinD;
  const x = A*Math.cos(lat1)*Math.cos(lng1) + B*Math.cos(lat2)*Math.cos(lng2);
  const y = A*Math.cos(lat1)*Math.sin(lng1) + B*Math.cos(lat2)*Math.sin(lng2);
  const z = A*Math.sin(lat1)                + B*Math.sin(lat2);
  const lat = Math.atan2(z, Math.sqrt(x*x+y*y));
  const lng = Math.atan2(y, x);
  const t2 = Math.min(t + 0.001, 1);
  const A2=Math.sin((1-t2)*delta)/sinD, B2=Math.sin(t2*delta)/sinD;
  const x2=A2*Math.cos(lat1)*Math.cos(lng1)+B2*Math.cos(lat2)*Math.cos(lng2);
  const y2=A2*Math.cos(lat1)*Math.sin(lng1)+B2*Math.cos(lat2)*Math.sin(lng2);
  const z2=A2*Math.sin(lat1)+B2*Math.sin(lat2);
  const lat2r=Math.atan2(z2,Math.sqrt(x2*x2+y2*y2)), lng2r=Math.atan2(y2,x2);
  const heading = (Math.atan2(lng2r-lng, lat2r-lat) * 180 / Math.PI + 360) % 360;
  return { lat: lat/R, lng: lng/R, heading };
}

// ── Truck sprite canvas ────────────────────────────────────────────────────
// Regular: rectangular cab + trailer (top-down view)
// Tank: rectangular cab + oval tank body
const _truckTexCache = {};
function makeTruckCanvas(colorStr, isTank) {
  const key = colorStr + (isTank ? 'T' : 'R');
  if (_truckTexCache[key]) return _truckTexCache[key];
  const c = document.createElement('canvas');
  c.width = 28; c.height = 56;
  const ctx = c.getContext('2d');

  // Glow halo
  const glow = ctx.createRadialGradient(14, 28, 2, 14, 28, 16);
  glow.addColorStop(0, colorStr.replace(/[\d.]+\)$/, '0.25)'));
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 28, 56);

  const bright = colorStr;
  const dim    = colorStr.replace(/[\d.]+\)$/, '0.65)');

  // Cab (same for both types)
  ctx.fillStyle = bright;
  ctx.fillRect(7, 2, 14, 13);
  // Windshield
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(9, 4, 10, 6);

  if (isTank) {
    // Oval tank body
    ctx.fillStyle = dim;
    ctx.beginPath();
    ctx.ellipse(14, 38, 9, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    // Highlight
    ctx.fillStyle = colorStr.replace(/[\d.]+\)$/, '0.28)');
    ctx.beginPath();
    ctx.ellipse(11, 34, 4, 8, -0.2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Rectangular trailer
    ctx.fillStyle = dim;
    ctx.fillRect(7, 17, 14, 34);
    // Rear door line
    ctx.strokeStyle = colorStr.replace(/[\d.]+\)$/, '0.3)');
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(7, 41);
    ctx.lineTo(21, 41);
    ctx.stroke();
  }

  _truckTexCache[key] = c;
  return c;
}

function setSpritePos(sprite, lat, lng, alt, globeRadius) {
  const phi   = (90 - lat)  * Math.PI / 180;
  const theta = (90 - lng) * Math.PI / 180;
  const r = globeRadius * (1 + alt);
  sprite.position.set(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

export default function LandGlobe({ trucks, ports, onTruckClick, focusTarget, width, height }) {
  const globeRef  = useRef();
  const threeRefs = useRef({ scene: null, camera: null, renderer: null, sprites: new Map() });
  const rafRef    = useRef();
  const moonSetupDone = useRef(false);

  const setupMoon = useCallback((scene, globeRadius) => {
    if (moonSetupDone.current) return;
    moonSetupDone.current = true;
    const mc = document.createElement('canvas');
    mc.width = 128; mc.height = 128;
    const mctx = mc.getContext('2d');
    const mg = mctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    mg.addColorStop(0, '#e2e8f0'); mg.addColorStop(0.6, '#cbd5e1'); mg.addColorStop(1, '#94a3b8');
    mctx.fillStyle = mg; mctx.beginPath(); mctx.arc(64, 64, 64, 0, Math.PI * 2); mctx.fill();
    for (let i = 0; i < 14; i++) {
      const cx = 10 + Math.random() * 108, cy = 10 + Math.random() * 108, r = 2 + Math.random() * 8;
      mctx.fillStyle = 'rgba(100,116,139,0.25)';
      mctx.beginPath(); mctx.arc(cx, cy, r, 0, Math.PI * 2); mctx.fill();
    }
    const moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(globeRadius * 0.12, 16, 16),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(mc) }),
    );
    const orbitR = globeRadius * 3.5;
    const orbitGeo = new THREE.BufferGeometry();
    const pts = [];
    for (let i = 0; i <= 128; i++) { const a = (i / 128) * Math.PI * 2; pts.push(Math.cos(a) * orbitR, 0, Math.sin(a) * orbitR); }
    orbitGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const orbitLine = new THREE.Line(orbitGeo, new THREE.LineBasicMaterial({ color: 0x1e293b, transparent: true, opacity: 0.35 }));
    scene.add(orbitLine);
    scene.add(moonMesh);
    const moonAngle = { v: 0 };
    const animMoon = () => { moonAngle.v += 0.0003; moonMesh.position.set(Math.cos(moonAngle.v) * orbitR, 0, Math.sin(moonAngle.v) * orbitR); requestAnimationFrame(animMoon); };
    animMoon();
  }, []);

  const onGlobeReady = useCallback(() => {
    const g = globeRef.current;
    if (!g) return;
    const renderer    = g.renderer();
    const scene       = g.scene();
    const camera      = g.camera();
    const globeRadius = g.getGlobeRadius();
    threeRefs.current = { ...threeRefs.current, scene, camera, renderer };
    setupMoon(scene, globeRadius);
    g.pointOfView(HOME_POV, 1200);

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      const refs = threeRefs.current;
      if (refs.sprites.size > 0) {
        const now = Date.now();
        for (const entry of refs.sprites.values()) {
          const { sprite, srcLat, srcLng, dstLat, dstLng, progress0, fetchTs, globeRadius: gr } = entry;
          const elapsed = (now - fetchTs) / 1000;
          const t = (progress0 + elapsed / 86400) % 1;
          const pt = gcPoint(srcLat, srcLng, dstLat, dstLng, t);
          setSpritePos(sprite, pt.lat, pt.lng, 0.035, gr);
          sprite.material.rotation = -(pt.heading * Math.PI / 180);
        }
      }
      renderer.render(scene, camera);
    };
    animate();
  }, [setupMoon]);

  // Clear sprite map on trucks refresh so RAF loop doesn't animate stale references
  useEffect(() => { threeRefs.current.sprites = new Map(); }, [trucks]);

  // Focus camera on a specific truck (called when user clicks event feed item)
  useEffect(() => {
    if (!focusTarget || !globeRef.current) return;
    globeRef.current.pointOfView({ lat: focusTarget.lat, lng: focusTarget.lng, altitude: 0.8 }, 900);
  }, [focusTarget]);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  // Full route arcs: dim at origin, bright at destination (same as FlightsGlobe)
  const arcs = useMemo(() =>
    trucks.filter(t => t.lat && t.lng).map(t => ({
      startLat: t.srcLat, startLng: t.srcLng,
      endLat:   t.dstLat, endLng:   t.dstLng,
      color: [truckDim(t.type), truckColor(t.type)],
      id: t.id, progress: t.progress ?? 0,
    })),
  [trucks]);

  // Hub + port labels combined
  const allLabels = useMemo(() => [
    ...DISTRIBUTION_HUBS.map(h => ({
      lat: h.lat, lng: h.lng, text: h.code,
      size: 0.5,  color: 'rgba(0,212,255,0.75)',
      dotRadius: 0.35, dotColor: '#00d4ff', type: 'hub',
    })),
    ...ports.map(p => ({
      lat: p.lat, lng: p.lng, text: p.name,
      size: 0.4,  color: portStatusColor(p.status),
      dotRadius: 0.28, dotColor: portStatusColor(p.status), type: 'port',
    })),
  ], [ports]);

  // Border crossing rings + congested/disrupted port rings
  const allRings = useMemo(() => [
    ...BORDER_CROSSINGS.map(b => ({
      lat: b.lat, lng: b.lng,
      maxRadius: b.maxRadius, propagationSpeed: b.propagationSpeed,
      repeatPeriod: b.repeatPeriod, color: b.color,
    })),
    ...ports.filter(p => p.status !== 'clear').map(p => ({
      lat: p.lat, lng: p.lng,
      maxRadius: p.status === 'disruption' ? 4 : 3,
      propagationSpeed: p.status === 'disruption' ? 2.5 : 1.5,
      repeatPeriod: p.status === 'disruption' ? 700 : 1000,
      color: portStatusColor(p.status),
    })),
  ], [ports]);

  return (
    <Globe
      ref={globeRef}
      width={width}
      height={height}
      onGlobeReady={onGlobeReady}
      globeImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
      backgroundColor="rgba(0,0,0,0)"
      atmosphereColor="rgba(0,180,255,0.25)"
      atmosphereAltitude={0.25}

      arcsData={arcs}
      arcStartLat="startLat" arcStartLng="startLng"
      arcEndLat="endLat"     arcEndLng="endLng"
      arcColor="color"
      arcDashLength={0.35} arcDashGap={0.6} arcDashAnimateTime={4500}
      arcStroke={0.4} arcAltitudeAutoScale={0.3}

      labelsData={allLabels}
      labelLat="lat" labelLng="lng" labelText="text"
      labelSize="size" labelColor="color"
      labelDotRadius="dotRadius" labelDotOrientation="bottom"
      labelResolution={2} labelAltitude={0.005}

      ringsData={allRings}
      ringLat="lat" ringLng="lng"
      ringMaxRadius="maxRadius"
      ringPropagationSpeed="propagationSpeed"
      ringRepeatPeriod="repeatPeriod"
      ringColor="color"
      ringResolution={48}

      customLayerData={trucks.filter(t => t.lat && t.lng)}
      customThreeObject={truck => {
        const isTank   = truck.type === 'tank';
        const colorStr = isTank ? TANK_COLOR : REGULAR_COLOR;
        const tex = new THREE.CanvasTexture(makeTruckCanvas(colorStr, isTank));
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
        const s   = new THREE.Sprite(mat);
        s.scale.set(1.4, isTank ? 2.4 : 2.8, 1);
        return s;
      }}
      customThreeObjectUpdate={(sprite, truck) => {
        const refs = threeRefs.current;
        const gr   = globeRef.current?.getGlobeRadius?.() ?? 100;
        setSpritePos(sprite, truck.lat, truck.lng, 0.035, gr);
        sprite.material.rotation = -(truck.heading * Math.PI / 180);
        refs.sprites.set(truck.id, {
          sprite, globeRadius: gr,
          srcLat: truck.srcLat, srcLng: truck.srcLng,
          dstLat: truck.dstLat, dstLng: truck.dstLng,
          progress0: truck.progress ?? 0,
          fetchTs: Date.now() - ((truck.progress ?? 0) * 86400000),
        });
      }}
      onCustomLayerClick={obj => onTruckClick?.(obj)}
    />
  );
}
```

**Step 2: Verify no import errors**

```bash
cd frontend && npx vite build 2>&1 | grep -i "error\|warn" | head -20
```

Expected: only chunk-size warnings, no errors.

**Step 3: Commit**

```bash
git add frontend/src/components/LandGlobe.jsx
git commit -m "feat: LandGlobe — topology texture, truck sprites, route arcs, border rings, RAF animation"
```

---

## Task 5: LandFreightPage.jsx (page wrapper)

**Files:**
- Create: `frontend/src/pages/LandFreightPage.jsx`

**Step 1: Create LandFreightPage.jsx**

This mirrors `FlightsPage.jsx` exactly. No live API — trucks are always simulated. Fetches both `/api/trucks` and `/api/globe-data` (for ports).

```jsx
// frontend/src/pages/LandFreightPage.jsx
import { useState, useEffect, useRef, Component } from 'react';
import { RiTruckLine, RiRefreshLine } from 'react-icons/ri';

class GlobeErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  componentDidCatch(e) { console.error('LandGlobe WebGL error:', e); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: '#334155', fontFamily: "'JetBrains Mono', monospace" }}>
          <div style={{ fontSize: 11, letterSpacing: '0.1em' }}>RENDERER ERROR — WEBGL CONTEXT LOST</div>
          <button
            style={{ fontSize: 9, background: 'none', border: '1px solid rgba(250,204,21,0.2)', color: '#facc15', padding: '5px 14px', cursor: 'pointer', borderRadius: 4, letterSpacing: '0.08em' }}
            onClick={() => this.setState({ error: null })}
          >RELOAD GLOBE</button>
        </div>
      );
    }
    return this.props.children;
  }
}

class PanelErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  componentDidCatch(e) { console.error('LGPanel error:', e); }
  render() {
    if (this.state.error) return null;
    return this.props.children;
  }
}

import LandGlobe from '../components/LandGlobe';
import LGPanel from '../components/LGPanel';
import './LandFreightPage.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export default function LandFreightPage() {
  const [trucks, setTrucks]             = useState([]);
  const [ports, setPorts]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [selectedTruck, setSelectedTruck] = useState(null);
  const [focusTarget, setFocusTarget]   = useState(null);
  const wrapRef = useRef(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  const fetchTrucks = () => {
    setLoading(true);
    fetch(`${API}/api/trucks`)
      .then(r => r.json())
      .then(d => { setTrucks(d.trucks || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  const handleFeedTruckClick = (truck) => {
    setSelectedTruck(truck);
    setFocusTarget({ lat: truck.lat, lng: truck.lng, ts: Date.now() });
  };

  useEffect(() => {
    fetchTrucks();
    fetch(`${API}/api/globe-data`)
      .then(r => r.json())
      .then(d => setPorts(d.ports || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const measure = () => {
      if (!wrapRef.current) return;
      setDims({ w: wrapRef.current.offsetWidth, h: wrapRef.current.offsetHeight });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="lg-page">
      <div className="lg-header">
        <RiTruckLine size={15} className="lg-header-icon" />
        <span className="lg-header-title">LAND FREIGHT</span>
        <span className="lg-truck-count">{trucks.length} trucks tracked</span>
        <button className="lg-refresh-btn" onClick={fetchTrucks} title="Refresh">
          <RiRefreshLine size={13} className={loading ? 'lg-spin' : ''} />
        </button>
        <div className="lg-border-badges">
          <span className="lg-bz-badge green">Laredo</span>
          <span className="lg-bz-badge amber">Dover</span>
          <span className="lg-bz-badge red">Brest</span>
        </div>
      </div>

      <div className="lg-body">
        <div className="lg-globe-wrap" ref={wrapRef}>
          {dims.w > 0 && (
            <GlobeErrorBoundary>
              <LandGlobe
                trucks={trucks}
                ports={ports}
                onTruckClick={setSelectedTruck}
                focusTarget={focusTarget}
                width={dims.w}
                height={dims.h}
              />
            </GlobeErrorBoundary>
          )}
          <div className="lg-legend">
            <span style={{ color: '#facc15' }}>&#9632; Regular Truck</span>
            <span style={{ color: '#a3e635' }}>&#9632; Tank Truck</span>
            <span style={{ color: '#00d4ff' }}>&#9679; Distribution Hub</span>
            <span style={{ color: '#10b981' }}>&#9679; Port Clear</span>
            <span style={{ color: '#f59e0b' }}>&#9679; Port Congested</span>
            <span style={{ color: '#ef4444' }}>&#9679; Disruption</span>
            <span style={{ color: '#f59e0b' }}>&#9675; Border Crossing</span>
          </div>
          <div className="lg-scanline" />
        </div>
        <PanelErrorBoundary>
          <LGPanel
            trucks={trucks}
            selectedTruck={selectedTruck}
            onClearTruck={() => setSelectedTruck(null)}
            onFeedTruckClick={handleFeedTruckClick}
          />
        </PanelErrorBoundary>
      </div>
    </div>
  );
}
```

**Step 2: Build to verify everything compiles**

```bash
cd frontend && npm run build 2>&1 | tail -15
```

Expected: `✓ built in XX.XXs` with no errors. Chunk-size warnings are fine.

**Step 3: Commit**

```bash
git add frontend/src/pages/LandFreightPage.jsx
git commit -m "feat: LandFreightPage wrapper — header, globe, panel, port fetch, resize observer"
```

---

## Task 6: App.jsx + Sidebar.jsx — wire up the route

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/Sidebar.jsx`

**Step 1: Add import and route to App.jsx**

In `frontend/src/App.jsx`, add the import after the FlightsPage import (line 13):

```javascript
import LandFreightPage from './pages/LandFreightPage';
```

Then add the route inside `<Routes>` after the flights route (around line 173):

```jsx
<Route path="/land" element={<LandFreightPage />} />
```

**Step 2: Add sidebar entry to Sidebar.jsx**

In `frontend/src/components/Sidebar.jsx`, confirm `RiTruckLine` is imported from `react-icons/ri`. Check the existing imports at the top of the file. If not present, add it to the import line.

Then in the `NAV` array (around line 12, after the Air Freight entry), add:

```javascript
{ to: '/land',     Icon: RiTruckLine,            label: 'Land Freight'        },
```

The NAV array should look like:
```javascript
const NAV = [
  { to: '/',            Icon: RiGlobalLine,          label: 'Home'                },
  { to: '/vessels',     Icon: RiShipLine,             label: 'Ocean Freight'       },
  { to: '/flights',     Icon: RiPlaneLine,            label: 'Air Freight'         },
  { to: '/land',        Icon: RiTruckLine,            label: 'Land Freight'        },
  { to: '/market',      Icon: RiRadarLine,            label: 'Market Map'          },
  { to: '/trade',       Icon: RiLineChartLine,        label: 'Trade Intelligence'  },
  { to: '/research',    Icon: RiSearchEyeLine,        label: 'Quick Research'      },
  { to: '/performance', Icon: RiBarChartGroupedLine,  label: 'SDR Dashboard'       },
];
```

**Step 3: Check that RiTruckLine exists**

```bash
node -e "const ri = require('react-icons/ri'); console.log(Object.keys(ri).filter(k => k.includes('Truck')))"
```

Expected output includes `RiTruckLine`. If it does NOT appear, use `RiCarLine` as fallback (change the import and the NAV entry). But it should exist — it's a standard Remix Icon.

**Step 4: Final build**

```bash
cd frontend && npm run build 2>&1 | tail -15
```

Expected: `✓ built in XX.XXs`, no errors.

**Step 5: Smoke test in browser**

```bash
cd frontend && npm run dev
```

Open http://localhost:5173/land — verify:
- Globe renders with topology (terrain) texture
- Yellow and lime truck icons are visible and moving
- Right panel shows Fleet Overview with truck counts
- Carrier Watch shows JB Hunt, Werner, Schneider, etc.
- Hot Corridors shows routes (LA → New York, etc.)
- Event feed cycles every 3.5s
- Clicking a feed item focuses globe on that truck
- Legend is visible bottom-left
- Header shows "LAND FREIGHT" with border badges (Laredo/Dover/Brest)

**Step 6: Commit and push**

```bash
git add frontend/src/App.jsx frontend/src/components/Sidebar.jsx
git commit -m "feat: wire /land route — Land Freight page in App + Sidebar"
git push
```

---

## Done

All 6 tasks complete. Railway will auto-deploy on push.

**Verification checklist after deploy:**
- [ ] `/land` route loads without errors
- [ ] 316 trucks visible on globe
- [ ] Trucks animate continuously (move each frame)
- [ ] Yellow = regular trucks, lime = tank trucks
- [ ] Port rings (green/amber/red) from `/api/globe-data` visible
- [ ] Border crossing rings at Laredo (green), Dover (amber), Brest (red), Khorgos (amber), Wagah (red)
- [ ] Moon + orbit visible
- [ ] Panel: all 4 sections populated
- [ ] Click truck in event feed → globe focuses + detail panel opens
- [ ] Sidebar shows "Land Freight" between Air Freight and Market Map
