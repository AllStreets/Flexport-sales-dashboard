// backend/services/pipelineService.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

function getDb() {
  const db = new sqlite3.Database(process.env.DB_PATH || path.join(__dirname, '..', 'flexport.db'));
  db.run('PRAGMA busy_timeout = 5000');
  db.run('PRAGMA journal_mode = WAL');
  return db;
}

const VALID_STAGES = ['new', 'researched', 'called', 'demo_booked', 'closed_won', 'closed_lost'];

function getPipeline() {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.all('SELECT p.*, pr.icp_score, pr.sector, pr.hq_location FROM pipeline p LEFT JOIN prospects pr ON p.prospect_id = pr.id ORDER BY p.updated_at DESC', [], (err, rows) => {
      db.close();
      if (err) return reject(err);
      // Group by stage
      const grouped = Object.fromEntries(VALID_STAGES.map(s => [s, []]));
      rows.forEach(r => { if (grouped[r.stage]) grouped[r.stage].push(r); });
      resolve(grouped);
    });
  });
}

function getPipelineCount() {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.get(
      "SELECT COUNT(*) as cnt FROM pipeline WHERE stage NOT IN ('closed_won', 'closed_lost')",
      [],
      (err, row) => {
        db.close();
        if (err) return reject(err);
        resolve(row?.cnt || 0);
      }
    );
  });
}

function addToPipeline({ prospect_id, company_name, stage = 'new', notes, next_action, next_action_date, deal_value }) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.run(`INSERT INTO pipeline (prospect_id, company_name, stage, notes, next_action, next_action_date, deal_value) VALUES (?,?,?,?,?,?,?)`,
      [prospect_id, company_name, stage, notes, next_action, next_action_date, deal_value || 0],
      function(err) { db.close(); if (err) return reject(err); resolve({ id: this.lastID, company_name, stage }); }
    );
  });
}

function updatePipeline(id, { stage, notes, next_action, next_action_date, deal_value }) {
  return new Promise((resolve, reject) => {
    if (stage && !VALID_STAGES.includes(stage)) return reject(new Error(`Invalid stage: ${stage}`));
    const db = getDb();
    // deal_value: pass null to keep existing value, pass a number to update
    const dvParam = (deal_value !== undefined && deal_value !== null) ? Number(deal_value) : null;
    db.run(
      `UPDATE pipeline SET stage=COALESCE(?,stage), notes=COALESCE(?,notes), next_action=COALESCE(?,next_action), next_action_date=COALESCE(?,next_action_date), deal_value=COALESCE(?,deal_value), updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [stage ?? null, notes ?? null, next_action ?? null, next_action_date ?? null, dvParam, id],
      function(err) { db.close(); if (err) return reject(err); if (this.changes === 0) return reject(new Error('Not found')); resolve({ id, stage }); }
    );
  });
}

function removeFromPipeline(id) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.run('DELETE FROM pipeline WHERE id = ?', [id], function(err) {
      db.close(); if (err) return reject(err); if (this.changes === 0) return reject(new Error('Not found')); resolve({ deleted: id });
    });
  });
}

module.exports = { getPipeline, getPipelineCount, addToPipeline, updatePipeline, removeFromPipeline };
