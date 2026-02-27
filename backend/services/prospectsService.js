// backend/services/prospectsService.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

function getDb() {
  return new sqlite3.Database(process.env.DB_PATH || path.join(__dirname, '..', 'flexport.db'));
}

function getProspects({ sector, icp_min, lane, search, limit = 50, offset = 0 } = {}) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    let query = 'SELECT * FROM prospects WHERE 1=1';
    const params = [];
    if (sector) { query += ' AND sector = ?'; params.push(sector); }
    if (icp_min) { query += ' AND icp_score >= ?'; params.push(parseInt(icp_min)); }
    if (lane) { query += ' AND primary_lanes LIKE ?'; params.push(`%${lane}%`); }
    if (search) { query += ' AND (name LIKE ? OR description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    query += ' ORDER BY icp_score DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    db.all(query, params, (err, rows) => {
      db.close();
      if (err) return reject(err);
      resolve(rows.map(r => ({
        ...r,
        import_origins: JSON.parse(r.import_origins || '[]'),
        primary_lanes: JSON.parse(r.primary_lanes || '[]')
      })));
    });
  });
}

function getProspectById(id) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.get('SELECT * FROM prospects WHERE id = ?', [id], (err, row) => {
      db.close();
      if (err) return reject(err);
      if (!row) return reject(new Error('Prospect not found'));
      resolve({ ...row, import_origins: JSON.parse(row.import_origins || '[]'), primary_lanes: JSON.parse(row.primary_lanes || '[]') });
    });
  });
}

function getSectors() {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.all('SELECT sector, COUNT(*) as count FROM prospects GROUP BY sector ORDER BY count DESC', [], (err, rows) => {
      db.close();
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

module.exports = { getProspects, getProspectById, getSectors };
