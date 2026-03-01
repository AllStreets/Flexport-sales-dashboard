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
      )`, (err) => {
        db.close();
        if (err) reject(err); else resolve();
      });
    });
  });
}

function getActivities() {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.all('SELECT * FROM sdr_activities ORDER BY date DESC', [], (err, rows) => {
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

function getPipelineMetrics() {
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
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.run(
      'INSERT INTO win_loss (company_name, outcome, stage_reached, competitor, reason, deal_value) VALUES (?,?,?,?,?,?)',
      [company_name, outcome, stage_reached || null, competitor || null, reason || null, deal_value || 0],
      function(err) { db.close(); if (err) return reject(err); resolve({ id: this.lastID }); }
    );
  });
}

async function getPerformanceSummary() {
  const [activities, pipeline, prospects, winloss] = await Promise.all([
    getActivities(), getPipelineMetrics(), getProspectCount(), getWinLoss()
  ]);

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  const thisWeek = activities.filter(a => a.date >= weekStartStr);
  const callsThisWeek  = thisWeek.filter(a => a.type === 'call').length;
  const emailsThisWeek = thisWeek.filter(a => a.type === 'email').length;
  const demosBooked    = (pipeline.demo_booked || 0) + (pipeline.closed_won || 0);
  const pipelineValue  = Object.values(pipeline).reduce((s, v) => s + v, 0) * 72000; // ~$72k avg annual freight spend for Flexport mid-market SMB

  return {
    kpis: { callsThisWeek, emailsThisWeek, demosBooked, pipelineValue },
    activities,
    pipeline: {
      totalProspects: prospects,
      totalPipeline:  Object.values(pipeline).reduce((s, v) => s + v, 0),
      calledPlus:     (pipeline.called || 0) + (pipeline.demo_booked || 0) + (pipeline.closed_won || 0) + (pipeline.closed_lost || 0),
      demoBooked:     pipeline.demo_booked || 0,
      closedWon:      pipeline.closed_won  || 0,
      byStage:        pipeline
    },
    winLoss: winloss
  };
}

module.exports = { initDb, getPerformanceSummary, logActivity, getWinLoss, addWinLoss };
