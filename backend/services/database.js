// backend/services/database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

function getDb() {
  const db = new sqlite3.Database(process.env.DB_PATH || path.join(__dirname, '..', 'flexport.db'));
  db.run('PRAGMA busy_timeout = 5000');
  db.run('PRAGMA journal_mode = WAL');
  return db;
}

function saveAnalysis(prospectId, companyName, analysisData) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const { profile, pain_points, tech_maturity, outreach_angle, decision_makers, icp_breakdown, flexport_value_props } = analysisData;
    db.run(
      `INSERT INTO analyses (prospect_id, company_name, profile, pain_points, tech_maturity, outreach_angle, decision_makers, icp_breakdown, flexport_value_props, analysis_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [prospectId || null, companyName,
       profile, JSON.stringify(pain_points), tech_maturity, outreach_angle,
       JSON.stringify(decision_makers), JSON.stringify(icp_breakdown),
       JSON.stringify(flexport_value_props), JSON.stringify(analysisData)],
      function(err) {
        db.close();
        if (err) return reject(err);
        resolve({ id: this.lastID, company_name: companyName });
      }
    );
  });
}

function getAllAnalyses() {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.all('SELECT * FROM analyses ORDER BY timestamp DESC', [], (err, rows) => {
      db.close();
      if (err) return reject(err);
      resolve(rows.map(parseAnalysisRow));
    });
  });
}

function toggleFavorite(id, isFavorite) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.run('UPDATE analyses SET is_favorite = ? WHERE id = ?', [isFavorite ? 1 : 0, id], function(err) {
      db.close();
      if (err) return reject(err);
      if (this.changes === 0) return reject(new Error('Analysis not found'));
      resolve({ id, is_favorite: isFavorite });
    });
  });
}

function deleteAnalysis(id) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.run('DELETE FROM analyses WHERE id = ?', [id], function(err) {
      db.close();
      if (err) return reject(err);
      if (this.changes === 0) return reject(new Error('Analysis not found'));
      resolve({ deleted: id });
    });
  });
}

function parseAnalysisRow(row) {
  return {
    ...row,
    pain_points: tryParse(row.pain_points, []),
    decision_makers: tryParse(row.decision_makers, []),
    icp_breakdown: tryParse(row.icp_breakdown, {}),
    flexport_value_props: tryParse(row.flexport_value_props, []),
    analysis_data: tryParse(row.analysis_data, {})
  };
}

function tryParse(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

module.exports = { saveAnalysis, getAllAnalyses, toggleFavorite, deleteAnalysis };
