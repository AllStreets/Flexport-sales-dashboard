// backend/routes/agentRoutes.js
const express = require('express');
const router = express.Router();
const {
  addToQueue, getQueue, getDrafts, getJobs, removeFromQueue,
  runBatch, runFollowUpDrafts, recalibrateScores, getAgentStatus, getAllConfig,
} = require('../services/agentService');
const {
  startOAuth, handleOAuthCallback, getOAuthStatus, disconnect, setConfig,
} = require('../services/gmailService');

// ── OAuth ──────────────────────────────────────────────────────────────────────
router.get('/oauth/start', startOAuth);
router.get('/oauth/callback', handleOAuthCallback);

router.get('/oauth/status', async (req, res) => {
  try { res.json(await getOAuthStatus()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/oauth/disconnect', async (req, res) => {
  try { await disconnect(); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Status ─────────────────────────────────────────────────────────────────────
router.get('/status', async (req, res) => {
  try { res.json(await getAgentStatus()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Config ─────────────────────────────────────────────────────────────────────
router.get('/config', async (req, res) => {
  try { res.json(await getAllConfig()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/config', async (req, res) => {
  const { key, value } = req.body;
  const allowed = ['enabled', 'batch_size', 'fit_score_min', 'high_fit_min', 'from_name', 'reply_poll_hours'];
  if (!allowed.includes(key)) return res.status(400).json({ error: 'Unknown config key' });
  try {
    await setConfig(key, String(value));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Queue ──────────────────────────────────────────────────────────────────────
router.get('/queue', async (req, res) => {
  try { res.json(await getQueue(req.query.status || null)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/queue/add', async (req, res) => {
  const { companies } = req.body;
  // companies: [{company_name, sector, website, priority}] or a plain string list
  const items = Array.isArray(companies)
    ? companies.map(c => typeof c === 'string' ? { company_name: c } : c)
    : [];
  if (!items.length) return res.status(400).json({ error: 'No companies provided' });
  try {
    const added = await addToQueue(items);
    res.json({ added });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/queue/:id', async (req, res) => {
  try { await removeFromQueue(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Jobs ───────────────────────────────────────────────────────────────────────
router.get('/jobs', async (req, res) => {
  try { res.json(await getJobs(parseInt(req.query.limit || '20'))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Manual run (SSE streaming) ─────────────────────────────────────────────────
router.post('/run', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (obj) => { if (!res.writableEnded) res.write(`data: ${JSON.stringify(obj)}\n\n`); };

  try {
    const result = await runBatch({
      triggeredBy: 'manual',
      onProgress: (progress) => send(progress),
    });
    send({ type: 'complete', ...result });
  } catch (e) {
    send({ type: 'error', error: e.message });
  }
  res.end();
});

// ── Drafts ─────────────────────────────────────────────────────────────────────
router.get('/drafts', async (req, res) => {
  try { res.json(await getDrafts(req.query.status || null)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/drafts/:id/followup', async (req, res) => {
  const sqlite3 = require('sqlite3').verbose();
  const path = require('path');
  const db = new sqlite3.Database(process.env.DB_PATH || path.join(__dirname, '..', 'flexport.db'));

  db.get('SELECT * FROM agent_drafts WHERE id = ?', [req.params.id], async (err, draft) => {
    db.close();
    if (!draft) return res.status(404).json({ error: 'Draft not found' });
    if (!draft.reply_body && !req.body.reply_body) return res.status(400).json({ error: 'No reply body available' });

    try {
      const result = await runFollowUpDrafts(draft, req.body.reply_body || draft.reply_body);
      res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
});

// ── Polls (manual trigger) ─────────────────────────────────────────────────────
router.post('/poll-replies', async (req, res) => {
  const { pollForReplies } = require('../services/gmailService');
  try { res.json(await pollForReplies()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/recalibrate', async (req, res) => {
  try { res.json(await recalibrateScores()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
