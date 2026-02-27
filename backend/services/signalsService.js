// backend/services/signalsService.js
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

function getDb() {
  return new sqlite3.Database(process.env.DB_PATH || path.join(__dirname, '..', 'flexport.db'));
}

async function fetchAndScoreSignals() {
  // Check cache (1 hour TTL)
  const cached = await getCachedSignals();
  if (cached.length > 0) return cached;

  const q = 'supply chain freight logistics tariff port disruption shipping';
  const newsRes = await axios.get('https://newsapi.org/v2/everything', {
    params: { q, language: 'en', sortBy: 'publishedAt', pageSize: 20, apiKey: process.env.NEWS_API_KEY }
  });

  const articles = newsRes.data.articles || [];
  if (articles.length === 0) return [];

  // Score urgency with OpenAI
  const scorePrompt = `You are scoring news articles for urgency to a Flexport inbound SDR. Rate each from 1-10 where 10 = "call prospects now".

Articles:
${articles.map((a, i) => `${i + 1}. ${a.title}`).join('\n')}

Return a JSON array (same order as input):
[{"urgency_score": 8, "urgency_reason": "Port congestion on Asia-US West Coast affects electronics importers", "affected_lanes": ["Asia-US West Coast"], "affected_sectors": ["electronics","e-commerce"]}]`;

  const scoreRes = await axios.post(OPENAI_URL, {
    model: 'gpt-4-turbo', max_tokens: 1000,
    messages: [{ role: 'user', content: scorePrompt }]
  }, { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' } });

  let scores = [];
  try {
    const m = scoreRes.data.choices[0].message.content.match(/\[[\s\S]*\]/);
    scores = m ? JSON.parse(m[0]) : [];
  } catch { scores = []; }

  const db = getDb();
  // Clear old signals, insert new
  await new Promise(r => db.run('DELETE FROM news_signals', r));
  const stmt = db.prepare(`INSERT INTO news_signals (headline, summary, url, source, published_at, urgency_score, urgency_reason, affected_lanes, affected_sectors) VALUES (?,?,?,?,?,?,?,?,?)`);

  const signals = articles.map((a, i) => {
    const score = scores[i] || { urgency_score: 5, urgency_reason: 'General supply chain news', affected_lanes: [], affected_sectors: [] };
    stmt.run(a.title, a.description, a.url, a.source?.name, a.publishedAt,
      score.urgency_score, score.urgency_reason,
      JSON.stringify(score.affected_lanes || []), JSON.stringify(score.affected_sectors || []));
    return { ...a, ...score };
  });

  stmt.finalize();
  db.close();
  return signals;
}

async function getCachedSignals() {
  return new Promise((resolve) => {
    const db = getDb();
    db.all(`SELECT * FROM news_signals WHERE cached_at > datetime('now', '-1 hour') ORDER BY urgency_score DESC`, [], (err, rows) => {
      db.close();
      if (err || !rows) return resolve([]);
      resolve(rows.map(r => ({ ...r, affected_lanes: JSON.parse(r.affected_lanes || '[]'), affected_sectors: JSON.parse(r.affected_sectors || '[]') })));
    });
  });
}

module.exports = { fetchAndScoreSignals };
