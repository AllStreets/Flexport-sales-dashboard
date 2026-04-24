// backend/services/agentService.js
// Core autonomous research → score → draft pipeline
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { aggregateCompanyData } = require('./dataAggregator');
const { analyzeForFlexport } = require('./flexportAnalyzer');
const { createDraft, getConfig, setConfig } = require('./gmailService');

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

function getDb() {
  return new sqlite3.Database(process.env.DB_PATH || path.join(__dirname, '..', 'flexport.db'));
}

// ── Config helpers ─────────────────────────────────────────────────────────────

async function getAllConfig() {
  return new Promise((resolve) => {
    const db = getDb();
    db.all('SELECT key, value FROM agent_config', [], (err, rows) => {
      db.close();
      if (!rows) return resolve({});
      resolve(Object.fromEntries(rows.map(r => [r.key, r.value])));
    });
  });
}

// ── Queue management ──────────────────────────────────────────────────────────

function addToQueue(items) {
  // items: [{company_name, sector, website, priority}]
  return new Promise((resolve, reject) => {
    const db = getDb();
    const stmt = db.prepare(
      `INSERT OR IGNORE INTO agent_queue (company_name, sector, website, priority)
       VALUES (?, ?, ?, ?)`
    );
    let added = 0;
    for (const item of items) {
      stmt.run(item.company_name, item.sector || null, item.website || null, item.priority || 5, function() {
        if (this.changes > 0) added++;
      });
    }
    stmt.finalize(() => { db.close(); resolve(added); });
  });
}

function getQueue(status) {
  return new Promise((resolve) => {
    const db = getDb();
    const where = status ? `WHERE q.status = '${status}'` : '';
    db.all(
      `SELECT q.*, p.icp_score as existing_icp
       FROM agent_queue q
       LEFT JOIN prospects p ON lower(p.name) = lower(q.company_name)
       ${where}
       ORDER BY COALESCE(p.icp_score, 0) DESC, q.priority DESC, q.created_at ASC`,
      [],
      (err, rows) => { db.close(); resolve(rows || []); }
    );
  });
}

function getDrafts(status) {
  return new Promise((resolve) => {
    const db = getDb();
    const where = status ? `WHERE status = '${status}'` : '';
    db.all(
      `SELECT * FROM agent_drafts ${where} ORDER BY created_at DESC`,
      [],
      (err, rows) => { db.close(); resolve(rows || []); }
    );
  });
}

function getJobs(limit = 20) {
  return new Promise((resolve) => {
    const db = getDb();
    db.all(
      `SELECT * FROM agent_jobs ORDER BY created_at DESC LIMIT ?`,
      [limit],
      (err, rows) => { db.close(); resolve(rows || []); }
    );
  });
}

function removeFromQueue(id) {
  return new Promise((resolve) => {
    const db = getDb();
    db.run('DELETE FROM agent_queue WHERE id = ?', [id], () => { db.close(); resolve(); });
  });
}

// ── LinkedIn search ────────────────────────────────────────────────────────────

async function searchLinkedInUrl(companyName) {
  if (!process.env.SERPER_API_KEY) return null;
  try {
    const res = await axios.post('https://google.serper.dev/search', {
      q: `${companyName} VP Supply Chain OR "Head of Logistics" OR "Director of Operations" site:linkedin.com/in`,
      num: 3,
    }, { headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' } });
    const results = res.data.organic || [];
    for (const r of results) {
      const m = (r.link || '').match(/linkedin\.com\/in\/[a-z0-9_-]+/i);
      if (m) return `https://www.${m[0]}`;
    }
    return null;
  } catch { return null; }
}

// ── AI scoring ────────────────────────────────────────────────────────────────

async function scoreCompanyFit(companyName, aggregatedData) {
  const searchSnippets = (aggregatedData.searchResults || []).slice(0, 5).map(r => `- ${r.title}: ${r.snippet || ''}`).join('\n');
  const newsSnippets = (aggregatedData.news || []).slice(0, 3).map(n => `- ${n.title}`).join('\n');

  const prompt = `Rate this company as a Flexport freight forwarding prospect on a scale of 1-10.

Company: ${companyName}

Search context:
${searchSnippets || 'No data'}

Recent news:
${newsSnippets || 'No news'}

Scoring criteria:
10: Major importer/exporter with complex multi-lane freight needs
8-9: Regular importer, clear freight pain points, likely uses a forwarder
6-7: Moderate import activity, could benefit from Flexport
4-5: Some import activity but low volume or mostly domestic
1-3: Domestic only, no import/export signals, poor fit

Return JSON only (fit_score must reflect the actual evidence above, not a default):
{"fit_score": 5, "reasoning": "...", "sector": "...", "skip_reason": null, "contact_title": "VP Supply Chain", "contact_email_guess": null}

If clearly not a fit (fit_score <= 4), set skip_reason to a brief phrase like "domestic-only" or "service-company".`;

  const res = await axios.post(OPENAI_URL, {
    model: 'gpt-4.1-mini',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  }, { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' } });

  const content = res.data.choices[0].message.content;
  const m = content.match(/\{[\s\S]*\}/);
  if (!m) return { fit_score: 3, reasoning: 'Parse failed', skip_reason: 'parse_error' };
  try { return JSON.parse(m[0]); } catch { return { fit_score: 3, skip_reason: 'parse_error' }; }
}

// ── Draft generation ──────────────────────────────────────────────────────────

async function generateDraft(companyName, analysis, linkedinUrl, model = 'gpt-4.1-mini') {
  const valueProps = (analysis.flexport_value_props || []).slice(0, 2).join(', ');
  const angle = analysis.outreach_angle || '';
  const dm = analysis.decision_makers?.[0];

  const prompt = `Write a cold outreach email for an SDR at Flexport targeting ${companyName}.

Decision maker target: ${dm?.title || 'VP Supply Chain or Head of Logistics'}
Company profile: ${analysis.profile || ''}
Outreach angle: ${angle}
Key value props: ${valueProps}
${linkedinUrl ? `LinkedIn profile: ${linkedinUrl}` : ''}

Rules:
- Max 150 words
- No fluff, no "I hope this finds you well"
- Specific to their lanes, pain points, or recent news
- End with a single low-friction CTA (15-min call)
- Subject line must be specific, not generic
- Use only plain ASCII characters — straight apostrophes ('), no curly/smart quotes or special punctuation

Return JSON only:
{"subject": "...", "body": "...", "contact_title": "${dm?.title || 'VP Supply Chain'}", "to_placeholder": "firstname@${companyName.toLowerCase().replace(/\s+/g, '')}.com"}`;

  const res = await axios.post(OPENAI_URL, {
    model,
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  }, { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' } });

  const content = res.data.choices[0].message.content;
  const m = content.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Draft generation parse failed');
  return JSON.parse(m[0]);
}

async function generateFollowUpDraft(originalDraft, replyBody) {
  const prompt = `Generate a follow-up email reply in a cold outreach sequence for Flexport.

Company: ${originalDraft.company_name}
Contact: ${originalDraft.contact_title || 'Unknown title'}
Original subject: ${originalDraft.subject}
Original email body: ${originalDraft.body}
Their reply: ${replyBody}

This is touch #${(originalDraft.touch_number || 1) + 1}.

Analyze the reply sentiment:
- Positive/interested → book a call, specific time slots
- Asking for more info → address their question, keep pushing for a call
- Objection → handle it directly, pivot to value
- Out of office / soft no → acknowledge, re-engage with new angle

Return JSON only:
{"subject": "Re: ${originalDraft.subject}", "body": "...", "reply_type": "interested|info_request|objection|soft_no"}`;

  const res = await axios.post(OPENAI_URL, {
    model: 'gpt-4.1',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  }, { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' } });

  const content = res.data.choices[0].message.content;
  const m = content.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Follow-up parse failed');
  return JSON.parse(m[0]);
}

// ── Feedback / score multiplier ───────────────────────────────────────────────

async function recalibrateScores() {
  return new Promise(async (resolve) => {
    const db = getDb();
    db.all(
      `SELECT d.company_name, q.sector, d.status
       FROM agent_drafts d
       LEFT JOIN agent_queue q ON q.id = d.queue_id
       WHERE d.created_at > datetime('now', '-30 days')`,
      [],
      async (err, rows) => {
        db.close();
        if (!rows || rows.length === 0) return resolve({});

        // Compute reply rate per sector
        const sectors = {};
        for (const r of rows) {
          const s = r.sector || 'unknown';
          if (!sectors[s]) sectors[s] = { total: 0, replied: 0 };
          sectors[s].total++;
          if (r.status === 'replied') sectors[s].replied++;
        }

        const boosts = {};
        for (const [sector, stats] of Object.entries(sectors)) {
          if (stats.total < 3) continue; // need minimum sample
          const replyRate = stats.replied / stats.total;
          // Sectors with >30% reply rate get a boost, <10% get a penalty
          if (replyRate > 0.3) boosts[sector] = Math.min(1.5, 1 + replyRate);
          else if (replyRate < 0.1) boosts[sector] = Math.max(0.7, 1 - (0.1 - replyRate) * 2);
          else boosts[sector] = 1.0;
        }

        await setConfig('sector_boosts', JSON.stringify(boosts));
        resolve(boosts);
      }
    );
  });
}

function applyFeedbackMultiplier(baseScore, sector, sectorBoosts) {
  if (!sector || !sectorBoosts) return baseScore;
  let boosts = sectorBoosts;
  if (typeof boosts === 'string') {
    try { boosts = JSON.parse(boosts); } catch { return baseScore; }
  }
  const multiplier = boosts[sector] || 1.0;
  return Math.round(Math.min(10, Math.max(1, baseScore * multiplier)));
}

// ── Main batch loop ───────────────────────────────────────────────────────────

async function runBatch({ triggeredBy = 'cron', onProgress = null } = {}) {
  const cfg = await getAllConfig();
  if (cfg.enabled !== '1') return { skipped_reason: 'agent_disabled' };

  const batchSize = parseInt(cfg.batch_size || '10');
  const fitMin = parseInt(cfg.fit_score_min || '7');
  const highFitMin = parseInt(cfg.high_fit_min || '9');
  const sectorBoosts = cfg.sector_boosts;

  // Create job record
  const jobId = await new Promise((resolve) => {
    const db = getDb();
    db.run(
      `INSERT INTO agent_jobs (job_type, status, triggered_by, started_at) VALUES ('batch_research', 'running', ?, datetime('now'))`,
      [triggeredBy],
      function() { db.close(); resolve(this.lastID); }
    );
  });

  const items = await getQueue('pending');
  const batch = items.slice(0, batchSize);
  let drafted = 0, skipped = 0, errors = 0;

  for (let i = 0; i < batch.length; i++) {
    const item = batch[i];
    if (onProgress) onProgress({ step: 'start', company: item.company_name, index: i + 1, total: batch.length });

    try {
      // Mark researching
      await updateQueueStatus(item.id, 'researching');

      // LinkedIn search (non-blocking)
      const linkedinUrl = await searchLinkedInUrl(item.company_name);
      if (linkedinUrl) {
        const db = getDb();
        db.run('UPDATE agent_queue SET linkedin_url = ? WHERE id = ?', [linkedinUrl, item.id]);
        db.close();
      }

      // Research
      if (onProgress) onProgress({ step: 'research', company: item.company_name });
      await updateQueueStatus(item.id, 'scoring');
      const aggregated = await aggregateCompanyData(item.company_name);

      // Score
      const scoreResult = await scoreCompanyFit(item.company_name, aggregated);
      const adjustedScore = applyFeedbackMultiplier(scoreResult.fit_score, scoreResult.sector || item.sector, sectorBoosts);

      // Update sector if discovered
      if (scoreResult.sector && !item.sector) {
        const db = getDb();
        db.run('UPDATE agent_queue SET sector = ? WHERE id = ?', [scoreResult.sector, item.id]);
        db.close();
      }

      if (adjustedScore < fitMin) {
        await skipQueueItem(item.id, adjustedScore, scoreResult.skip_reason || 'below_threshold');
        if (onProgress) onProgress({ step: 'skipped', company: item.company_name, score: adjustedScore });
        skipped++;
        continue;
      }

      // Full analysis
      await updateQueueStatus(item.id, 'drafting');
      if (onProgress) onProgress({ step: 'draft', company: item.company_name, score: adjustedScore });

      const newsHeadlines = (aggregated.news || []).map(n => n.title);
      const searchResults = aggregated.searchResults || [];
      const analysis = await analyzeForFlexport(item.company_name, null, newsHeadlines, searchResults, 'gpt-4.1-mini');

      const model = adjustedScore >= highFitMin ? 'gpt-4.1' : 'gpt-4.1-mini';
      const draftData = await generateDraft(item.company_name, analysis, linkedinUrl, model);

      // Push to Gmail as draft
      const toEmail = draftData.to_placeholder || `contact@${item.company_name.toLowerCase().replace(/\s+/g, '')}.com`;
      let gmailDraftId = null, gmailThreadId = null;

      try {
        const gmailResult = await createDraft({
          to: toEmail,
          subject: draftData.subject,
          body: draftData.body,
        });
        gmailDraftId = gmailResult.draftId;
        gmailThreadId = gmailResult.threadId;
      } catch (gmailErr) {
        console.warn(`Gmail draft creation failed for ${item.company_name}: ${gmailErr.message} — saving locally only`);
      }

      // Store in agent_drafts
      await new Promise((resolve) => {
        const db = getDb();
        db.run(
          `INSERT INTO agent_drafts (queue_id, company_name, contact_email, contact_title, gmail_draft_id, gmail_thread_id, touch_number, subject, body, status)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, 'draft')`,
          [item.id, item.company_name, toEmail, draftData.contact_title || null, gmailDraftId, gmailThreadId, draftData.subject, draftData.body],
          () => { db.close(); resolve(); }
        );
      });

      // Mark done
      const db = getDb();
      db.run(
        `UPDATE agent_queue SET status='done', fit_score=?, drafted_at=datetime('now'), last_updated=datetime('now') WHERE id=?`,
        [adjustedScore, item.id]
      );
      db.close();

      if (onProgress) onProgress({ step: 'done', company: item.company_name, score: adjustedScore, gmail: !!gmailDraftId });
      drafted++;

    } catch (e) {
      console.error(`Agent batch error for ${item.company_name}:`, e.message);
      const db = getDb();
      db.run(
        `UPDATE agent_queue SET status='error', error_msg=?, retry_count=retry_count+1, last_updated=datetime('now') WHERE id=?`,
        [e.message.slice(0, 200), item.id]
      );
      db.close();
      if (onProgress) onProgress({ step: 'error', company: item.company_name, error: e.message });
      errors++;
    }

    // Throttle between companies
    await new Promise(r => setTimeout(r, 1500));
  }

  const summary = JSON.stringify({ drafted, skipped, errors, total: batch.length });

  // Finish job record
  const db = getDb();
  db.run(
    `UPDATE agent_jobs SET status='done', finished_at=datetime('now'), items_processed=?, items_total=?, result_summary=? WHERE id=?`,
    [batch.length, batch.length, summary, jobId]
  );
  db.close();

  return { jobId, drafted, skipped, errors, total: batch.length };
}

async function runFollowUpDrafts(originalDraft, replyBody) {
  try {
    const draftData = await generateFollowUpDraft(originalDraft, replyBody);

    let gmailDraftId = null, gmailThreadId = null;
    try {
      const gmailResult = await createDraft({
        to: originalDraft.contact_email,
        subject: draftData.subject,
        body: draftData.body,
        threadId: originalDraft.gmail_thread_id,
        inReplyTo: originalDraft.gmail_thread_id,
        references: originalDraft.gmail_thread_id,
      });
      gmailDraftId = gmailResult.draftId;
      gmailThreadId = gmailResult.threadId;
    } catch (e) {
      console.warn('Gmail follow-up draft failed:', e.message);
    }

    const newDraftId = await new Promise((resolve) => {
      const db = getDb();
      db.run(
        `INSERT INTO agent_drafts (queue_id, company_name, contact_email, contact_title, gmail_draft_id, gmail_thread_id, touch_number, subject, body, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
        [originalDraft.queue_id, originalDraft.company_name, originalDraft.contact_email, originalDraft.contact_title,
         gmailDraftId, gmailThreadId, (originalDraft.touch_number || 1) + 1, draftData.subject, draftData.body],
        function() { db.close(); resolve(this.lastID); }
      );
    });

    // Link back to original
    const db = getDb();
    db.run('UPDATE agent_drafts SET follow_up_draft_id = ? WHERE id = ?', [newDraftId, originalDraft.id]);
    db.close();

    return { draftId: newDraftId, subject: draftData.subject };
  } catch (e) {
    console.error('Follow-up draft error:', e.message);
    throw e;
  }
}

// ── Status aggregation ────────────────────────────────────────────────────────

async function getAgentStatus() {
  const { getOAuthStatus } = require('./gmailService');
  const [oauthStatus, cfg, lastJob] = await Promise.all([
    getOAuthStatus().catch(() => ({ connected: false, email: null })),
    getAllConfig(),
    new Promise((resolve) => {
      const db = getDb();
      db.get('SELECT * FROM agent_jobs ORDER BY created_at DESC LIMIT 1', [], (err, row) => {
        db.close(); resolve(row || null);
      });
    }),
  ]);

  const queueCounts = await new Promise((resolve) => {
    const db = getDb();
    db.all(
      `SELECT status, COUNT(*) as count FROM agent_queue GROUP BY status`,
      [],
      (err, rows) => {
        db.close();
        resolve(Object.fromEntries((rows || []).map(r => [r.status, r.count])));
      }
    );
  });

  const draftCounts = await new Promise((resolve) => {
    const db = getDb();
    db.all(
      `SELECT status, COUNT(*) as count FROM agent_drafts GROUP BY status`,
      [],
      (err, rows) => {
        db.close();
        resolve(Object.fromEntries((rows || []).map(r => [r.status, r.count])));
      }
    );
  });

  return {
    enabled: cfg.enabled === '1',
    gmail: oauthStatus,
    last_job: lastJob,
    queue_counts: queueCounts,
    draft_counts: draftCounts,
    config: {
      batch_size: parseInt(cfg.batch_size || '10'),
      fit_score_min: parseInt(cfg.fit_score_min || '7'),
      high_fit_min: parseInt(cfg.high_fit_min || '9'),
      from_name: cfg.from_name || '',
      reply_poll_hours: parseInt(cfg.reply_poll_hours || '4'),
    },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function updateQueueStatus(id, status) {
  return new Promise((resolve) => {
    const db = getDb();
    db.run('UPDATE agent_queue SET status = ?, last_updated = datetime(\'now\') WHERE id = ?', [status, id], () => {
      db.close(); resolve();
    });
  });
}

function skipQueueItem(id, fitScore, reason) {
  return new Promise((resolve) => {
    const db = getDb();
    db.run(
      `UPDATE agent_queue SET status='skipped', fit_score=?, skip_reason=?, last_updated=datetime('now') WHERE id=?`,
      [fitScore, reason, id],
      () => { db.close(); resolve(); }
    );
  });
}

module.exports = {
  addToQueue, getQueue, getDrafts, getJobs, removeFromQueue,
  runBatch, runFollowUpDrafts, recalibrateScores,
  getAgentStatus, getAllConfig,
};
