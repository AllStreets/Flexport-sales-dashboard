const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'flexport.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS prospects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sector TEXT,
    hq_location TEXT,
    estimated_revenue TEXT,
    employee_count TEXT,
    shipping_volume_estimate TEXT,
    import_origins TEXT,
    primary_lanes TEXT,
    icp_score INTEGER,
    likely_forwarder TEXT,
    website TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prospect_id INTEGER REFERENCES prospects(id),
    company_name TEXT NOT NULL,
    profile TEXT,
    pain_points TEXT,
    tech_maturity TEXT,
    outreach_angle TEXT,
    decision_makers TEXT,
    icp_breakdown TEXT,
    flexport_value_props TEXT,
    analysis_data TEXT,
    is_favorite BOOLEAN DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS pipeline (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prospect_id INTEGER REFERENCES prospects(id),
    company_name TEXT NOT NULL,
    stage TEXT DEFAULT 'new',
    notes TEXT,
    next_action TEXT,
    next_action_date TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS news_signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    headline TEXT NOT NULL,
    summary TEXT,
    url TEXT,
    source TEXT,
    published_at TEXT,
    urgency_score INTEGER,
    urgency_reason TEXT,
    affected_lanes TEXT,
    affected_sectors TEXT,
    cached_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS trade_data_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    series_id TEXT NOT NULL,
    data_json TEXT NOT NULL,
    expires_at DATETIME,
    cached_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS sdr_activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    prospect_id INTEGER,
    company_name TEXT,
    date TEXT NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS win_loss (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_name TEXT NOT NULL,
    outcome TEXT NOT NULL,
    stage_reached TEXT,
    competitor TEXT,
    reason TEXT,
    deal_value INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) { console.error(err); process.exit(1); }
    console.log('All 7 tables created');
    db.close();
  });
});
