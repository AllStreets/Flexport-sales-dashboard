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
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS agent_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_name TEXT NOT NULL UNIQUE,
    sector TEXT,
    prospect_id INTEGER REFERENCES prospects(id),
    website TEXT,
    linkedin_url TEXT,
    priority INTEGER DEFAULT 5,
    status TEXT DEFAULT 'pending',
    fit_score INTEGER,
    skip_reason TEXT,
    error_msg TEXT,
    retry_count INTEGER DEFAULT 0,
    researched_at DATETIME,
    drafted_at DATETIME,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS agent_drafts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    queue_id INTEGER REFERENCES agent_queue(id),
    company_name TEXT NOT NULL,
    contact_email TEXT,
    contact_name TEXT,
    contact_title TEXT,
    gmail_draft_id TEXT,
    gmail_thread_id TEXT,
    touch_number INTEGER DEFAULT 1,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    sent_at DATETIME,
    replied_at DATETIME,
    deleted_at DATETIME,
    reply_body TEXT,
    follow_up_draft_id INTEGER REFERENCES agent_drafts(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS agent_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_type TEXT NOT NULL,
    status TEXT DEFAULT 'queued',
    started_at DATETIME,
    finished_at DATETIME,
    items_processed INTEGER DEFAULT 0,
    items_total INTEGER DEFAULT 0,
    error_msg TEXT,
    result_summary TEXT,
    triggered_by TEXT DEFAULT 'cron',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS vessel_cache (
    mmsi TEXT PRIMARY KEY,
    lat REAL,
    lng REAL,
    sog REAL,
    cog REAL,
    heading REAL,
    name TEXT,
    type INTEGER,
    destination TEXT,
    callsign TEXT,
    draught REAL,
    status INTEGER,
    ts INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS agent_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, () => {
    // Seed default config values
    const defaults = [
      ['enabled', '0'],
      ['batch_size', '10'],
      ['fit_score_min', '3'],
      ['high_fit_min', '9'],
      ['reply_poll_hours', '4'],
      ['gmail_user', ''],
      ['from_name', 'Connor Evans'],
      ['gmail_access_token', ''],
      ['gmail_refresh_token', ''],
      ['gmail_token_expiry', '0'],
      ['feedback_multiplier', '1.0'],
      ['sector_boosts', '{}'],
    ];
    const stmt = db.prepare('INSERT OR IGNORE INTO agent_config (key, value) VALUES (?, ?)');
    for (const [k, v] of defaults) stmt.run(k, v);
    stmt.finalize((err) => {
      if (err) { console.error(err); process.exit(1); }
      console.log('All 11 tables created + agent_config seeded');
      db.close();
    });
  });
});
