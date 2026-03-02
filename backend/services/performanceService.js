// backend/services/performanceService.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

function getDb() {
  return new sqlite3.Database(process.env.DB_PATH || path.join(__dirname, '..', 'flexport.db'));
}

function initDb() {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS sdr_activities (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        type        TEXT    NOT NULL,
        prospect_id INTEGER,
        company_name TEXT,
        date        TEXT    NOT NULL,
        notes       TEXT,
        created_at  TEXT    DEFAULT (datetime('now'))
      )`);
      db.run(`CREATE TABLE IF NOT EXISTS win_loss (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        company_name TEXT    NOT NULL,
        outcome      TEXT    NOT NULL,
        stage_reached TEXT,
        competitor   TEXT,
        reason       TEXT,
        deal_value   REAL    DEFAULT 0,
        created_at   TEXT    DEFAULT (datetime('now'))
      )`);
      // Safe migration — silently ignored if the column already exists
      db.run(`ALTER TABLE pipeline ADD COLUMN deal_value REAL DEFAULT 0`, () => {});
      db.run('SELECT 1', (err) => {
        db.close();
        if (err) reject(err); else resolve();
      });
    });
  });
}

function getActivities(retentionDays) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    let sql = 'SELECT * FROM sdr_activities';
    const params = [];
    if (retentionDays && retentionDays !== 'all') {
      const days = Math.max(1, parseInt(retentionDays, 10) || 365);
      sql += " WHERE date >= date('now', ?)";
      params.push(`-${days} days`);
    }
    sql += ' ORDER BY date DESC';
    db.all(sql, params, (err, rows) => {
      db.close();
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function logActivity({ type, prospect_id, company_name, date, notes }) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.run(
      'INSERT INTO sdr_activities (type, prospect_id, company_name, date, notes) VALUES (?,?,?,?,?)',
      [type, prospect_id || null, company_name || null, date || new Date().toISOString().slice(0, 10), notes || null],
      function(err) { db.close(); if (err) return reject(err); resolve({ id: this.lastID }); }
    );
  });
}

// Raw stage counts from pipeline table (for KPI calcs + byStage breakdown)
function getPipelineStages() {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.all('SELECT stage, COUNT(*) as cnt FROM pipeline GROUP BY stage', [], (err, rows) => {
      db.close();
      if (err) return reject(err);
      const byStage = {};
      rows.forEach(r => { byStage[r.stage] = r.cnt; });
      resolve(byStage);
    });
  });
}

// Funnel metrics — each stage is a UNION across pipeline, sdr_activities, and win_loss
// so logging an activity or a win/loss always feeds the funnel.
function getFunnelMetrics() {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const result = {};

    db.serialize(() => {
      // Total unique companies in pipeline (de-duplicated)
      db.get(
        'SELECT COUNT(DISTINCT lower(company_name)) as cnt FROM pipeline WHERE company_name IS NOT NULL',
        [],
        (err, row) => { result.totalPipeline = row?.cnt || 0; }
      );

      // Contacted = pipeline 'called'+ OR any sdr_activity (any type counts as outreach)
      db.get(
        `SELECT COUNT(DISTINCT lower(company_name)) as cnt FROM (
           SELECT company_name FROM pipeline
             WHERE stage IN ('called','demo_booked','closed_won','closed_lost')
             AND company_name IS NOT NULL
           UNION
           SELECT company_name FROM sdr_activities
             WHERE company_name IS NOT NULL
         )`,
        [],
        (err, row) => { result.calledPlus = row?.cnt || 0; }
      );

      // Demo Booked = pipeline at demo_booked/closed_won OR demo activities OR win_loss at demo stage
      db.get(
        `SELECT COUNT(DISTINCT lower(company_name)) as cnt FROM (
           SELECT company_name FROM pipeline
             WHERE stage IN ('demo_booked','closed_won')
             AND company_name IS NOT NULL
           UNION
           SELECT company_name FROM sdr_activities
             WHERE type = 'demo' AND company_name IS NOT NULL
           UNION
           SELECT company_name FROM win_loss
             WHERE stage_reached IN ('demo_booked','demo') AND company_name IS NOT NULL
         )`,
        [],
        (err, row) => { result.demoBooked = row?.cnt || 0; }
      );

      // Closed Won = pipeline 'closed_won' OR win_loss outcome='won'
      db.get(
        `SELECT COUNT(DISTINCT lower(company_name)) as cnt FROM (
           SELECT company_name FROM pipeline
             WHERE stage = 'closed_won' AND company_name IS NOT NULL
           UNION
           SELECT company_name FROM win_loss
             WHERE outcome = 'won' AND company_name IS NOT NULL
         )`,
        [],
        (err, row) => {
          result.closedWon = row?.cnt || 0;
          db.close();
          if (err) reject(err); else resolve(result);
        }
      );
    });
  });
}

function getProspectCount() {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.get('SELECT COUNT(*) as cnt FROM prospects', [], (err, row) => {
      db.close();
      if (err) return reject(err);
      resolve(row?.cnt || 0);
    });
  });
}

function getWinLoss() {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.all('SELECT * FROM win_loss ORDER BY created_at DESC', [], (err, rows) => {
      db.close();
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function addWinLoss({ company_name, outcome, stage_reached, competitor, reason, deal_value }) {
  // Use local time so created_at month matches the chart's JS new Date() month keys
  const now = new Date();
  const created_at = now.getFullYear() + '-'
    + String(now.getMonth() + 1).padStart(2, '0') + '-'
    + String(now.getDate()).padStart(2, '0') + ' '
    + String(now.getHours()).padStart(2, '0') + ':'
    + String(now.getMinutes()).padStart(2, '0') + ':'
    + String(now.getSeconds()).padStart(2, '0');
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.run(
      'INSERT INTO win_loss (company_name, outcome, stage_reached, competitor, reason, deal_value, created_at) VALUES (?,?,?,?,?,?,?)',
      [company_name, outcome, stage_reached || null, competitor || null, reason || null, deal_value || 0, created_at],
      function(err) { db.close(); if (err) return reject(err); resolve({ id: this.lastID }); }
    );
  });
}

// Sum of actual deal_value from active pipeline deals (excludes closed_lost)
function getPipelineDealValue() {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.get(
      "SELECT COALESCE(SUM(deal_value), 0) as total FROM pipeline WHERE stage NOT IN ('closed_lost')",
      [],
      (err, row) => {
        db.close();
        if (err) return reject(err);
        resolve(row?.total || 0);
      }
    );
  });
}

async function getPerformanceSummary(retentionDays) {
  const [activities, stages, funnel, prospects, winloss, dealValueSum] = await Promise.all([
    getActivities(retentionDays), getPipelineStages(), getFunnelMetrics(),
    getProspectCount(), getWinLoss(), getPipelineDealValue()
  ]);

  const now = new Date();
  const weekStart = new Date(now);
  const dowOffset = now.getDay() === 0 ? 6 : now.getDay() - 1;
  weekStart.setDate(now.getDate() - dowOffset);
  // Use local date to avoid UTC midnight shifting the week boundary
  const weekStartStr = weekStart.getFullYear() + '-' +
    String(weekStart.getMonth() + 1).padStart(2, '0') + '-' +
    String(weekStart.getDate()).padStart(2, '0');

  const thisWeek       = activities.filter(a => a.date >= weekStartStr);
  const callsThisWeek  = thisWeek.filter(a => a.type === 'call').length;
  const emailsThisWeek = thisWeek.filter(a => a.type === 'email').length;

  // Demos booked KPI = demos logged as activities THIS week (for weekly quota tracking)
  const demosBooked = thisWeek.filter(a => a.type === 'demo').length;

  // Pipeline value: use actual deal_value sum when any deals have values entered,
  // otherwise fall back to count × $72K estimate
  const pipelineValue = dealValueSum > 0
    ? dealValueSum
    : funnel.totalPipeline * 72000;

  return {
    kpis: { callsThisWeek, emailsThisWeek, demosBooked, pipelineValue },
    activities,
    pipeline: {
      totalProspects: prospects,
      totalPipeline:  funnel.totalPipeline,
      calledPlus:     funnel.calledPlus,
      demoBooked:     funnel.demoBooked,
      closedWon:      funnel.closedWon,
      byStage:        stages,
    },
    winLoss: winloss
  };
}

module.exports = { initDb, getPerformanceSummary, logActivity, getWinLoss, addWinLoss };
