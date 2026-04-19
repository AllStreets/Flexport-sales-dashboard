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

  // Fetch from two targeted queries and dedupe
  const queries = [
    '"port congestion" OR "freight rates" OR "ocean freight" OR "shipping delay" OR "supply chain disruption"',
    'tariff OR "trade war" OR "import duty" OR "customs" OR "air freight" OR "logistics disruption"',
  ];
  const results = await Promise.all(queries.map(q =>
    axios.get('https://newsapi.org/v2/everything', {
      params: { q, language: 'en', sortBy: 'publishedAt', pageSize: 12, apiKey: process.env.NEWS_API_KEY }
    }).then(r => r.data.articles || []).catch(() => [])
  ));

  // Dedupe by url, cap at 20
  const seen = new Set();
  const articles = results.flat().filter(a => {
    if (!a.url || seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  }).slice(0, 20);

  if (articles.length === 0) return [];

  // Score urgency with OpenAI — explicit instruction to use full 1-10 range
  const scorePrompt = `You are scoring news articles for urgency to a Flexport inbound SDR who sells freight forwarding to importers and exporters. Rate each article from 1-10:
- 9-10: Active port closure, major lane disruption, emergency tariff — call prospects TODAY
- 7-8: Significant freight rate spike, new tariffs announced, port congestion building
- 5-6: Moderate supply chain signal, trade policy update with future impact
- 3-4: Background industry news, minor regulatory change
- 1-2: Tangentially related or not relevant to freight at all

IMPORTANT: Vary scores meaningfully. Do NOT give the same score to all articles.

Articles:
${articles.map((a, i) => `${i + 1}. ${a.title}`).join('\n')}

Return a JSON array (same order as input):
[{"urgency_score": 8, "urgency_reason": "Port congestion on Asia-US West Coast affects electronics importers", "affected_lanes": ["Asia-US West Coast"], "affected_sectors": ["electronics","e-commerce"]}]`;

  const scoreRes = await axios.post(OPENAI_URL, {
    model: 'gpt-4.1-mini', max_tokens: 2000,
    messages: [{ role: 'user', content: scorePrompt }]
  }, { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' } });

  let scores = [];
  try {
    const content = scoreRes.data.choices[0].message.content;
    const m = content.match(/\[[\s\S]*\]/);
    scores = m ? JSON.parse(m[0]) : [];
  } catch { scores = []; }

  const db = getDb();
  // Clear old signals, insert new
  await new Promise(r => db.run('DELETE FROM news_signals', r));
  const stmt = db.prepare(`INSERT INTO news_signals (headline, summary, url, source, published_at, urgency_score, urgency_reason, affected_lanes, affected_sectors) VALUES (?,?,?,?,?,?,?,?,?)`);

  const signals = articles
    .map((a, i) => {
      const score = scores[i] || { urgency_score: 3, urgency_reason: '', affected_lanes: [], affected_sectors: [] };
      return { ...a, ...score, source: a.source?.name || a.source || '' };
    })
    .filter(s => (s.urgency_score || 0) >= 3)  // drop clearly irrelevant articles
    .sort((a, b) => b.urgency_score - a.urgency_score);

  for (const s of signals) {
    stmt.run(s.title, s.description, s.url, s.source?.name, s.publishedAt,
      s.urgency_score, s.urgency_reason,
      JSON.stringify(s.affected_lanes || []), JSON.stringify(s.affected_sectors || []));
  }

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
