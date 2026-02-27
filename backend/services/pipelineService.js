// backend/services/pipelineService.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

function getDb() {
  return new sqlite3.Database(process.env.DB_PATH || path.join(__dirname, '..', 'flexport.db'));
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

function addToPipeline({ prospect_id, company_name, stage = 'new', notes, next_action, next_action_date }) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.run(`INSERT INTO pipeline (prospect_id, company_name, stage, notes, next_action, next_action_date) VALUES (?,?,?,?,?,?)`,
      [prospect_id, company_name, stage, notes, next_action, next_action_date],
      function(err) { db.close(); if (err) return reject(err); resolve({ id: this.lastID, company_name, stage }); }
    );
  });
}

function updatePipeline(id, { stage, notes, next_action, next_action_date }) {
  return new Promise((resolve, reject) => {
    if (stage && !VALID_STAGES.includes(stage)) return reject(new Error(`Invalid stage: ${stage}`));
    const db = getDb();
    db.run(`UPDATE pipeline SET stage=COALESCE(?,stage), notes=COALESCE(?,notes), next_action=COALESCE(?,next_action), next_action_date=COALESCE(?,next_action_date), updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [stage, notes, next_action, next_action_date, id],
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

module.exports = { getPipeline, addToPipeline, updatePipeline, removeFromPipeline };
