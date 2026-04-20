// backend/services/gmailService.js
const { google } = require('googleapis');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

function getDb() {
  return new sqlite3.Database(process.env.DB_PATH || path.join(__dirname, '..', 'flexport.db'));
}

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI || 'http://localhost:5000/api/agent/oauth/callback'
  );
}

// ── Config helpers ─────────────────────────────────────────────────────────────

function getConfig(key) {
  return new Promise((resolve) => {
    const db = getDb();
    db.get('SELECT value FROM agent_config WHERE key = ?', [key], (err, row) => {
      db.close();
      resolve(row ? row.value : null);
    });
  });
}

function setConfig(key, value) {
  return new Promise((resolve) => {
    const db = getDb();
    db.run(
      `INSERT INTO agent_config (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
      [key, value],
      () => { db.close(); resolve(); }
    );
  });
}

// ── Token management ───────────────────────────────────────────────────────────

async function getAuthorizedClient() {
  const [accessToken, refreshToken, expiry] = await Promise.all([
    getConfig('gmail_access_token'),
    getConfig('gmail_refresh_token'),
    getConfig('gmail_token_expiry'),
  ]);

  if (!refreshToken) throw new Error('Gmail not connected — authorize first');

  const oauth2 = getOAuth2Client();
  oauth2.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: parseInt(expiry || '0'),
  });

  // Refresh if expired or within 5 minutes of expiry
  if (!expiry || Date.now() > parseInt(expiry) - 5 * 60 * 1000) {
    const { credentials } = await oauth2.refreshAccessToken();
    await Promise.all([
      setConfig('gmail_access_token', credentials.access_token),
      setConfig('gmail_token_expiry', String(credentials.expiry_date || Date.now() + 3600000)),
    ]);
    oauth2.setCredentials(credentials);
  }

  return oauth2;
}

// ── OAuth flow ─────────────────────────────────────────────────────────────────

function startOAuth(req, res) {
  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET) {
    return res.status(400).json({ error: 'GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET env vars required' });
  }
  const oauth2 = getOAuth2Client();
  const url = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/gmail.readonly',
    ],
  });
  res.redirect(url);
}

async function handleOAuthCallback(req, res) {
  const { code, error } = req.query;
  if (error) return res.status(400).json({ error });
  if (!code) return res.status(400).json({ error: 'Missing code' });

  try {
    const oauth2 = getOAuth2Client();
    const { tokens } = await oauth2.getToken(code);
    await Promise.all([
      setConfig('gmail_access_token', tokens.access_token || ''),
      setConfig('gmail_refresh_token', tokens.refresh_token || ''),
      setConfig('gmail_token_expiry', String(tokens.expiry_date || Date.now() + 3600000)),
    ]);

    // Get the authenticated user's email address
    oauth2.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2 });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    await setConfig('gmail_user', profile.data.emailAddress || '');

    // Redirect back to the frontend autonomous tab
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    res.redirect(`${frontendUrl}/#autonomous`);
  } catch (e) {
    console.error('OAuth callback error:', e.message);
    res.status(500).json({ error: e.message });
  }
}

async function getOAuthStatus() {
  const [refreshToken, gmailUser] = await Promise.all([
    getConfig('gmail_refresh_token'),
    getConfig('gmail_user'),
  ]);
  return {
    connected: !!refreshToken,
    email: gmailUser || null,
  };
}

async function disconnect() {
  await Promise.all([
    setConfig('gmail_access_token', ''),
    setConfig('gmail_refresh_token', ''),
    setConfig('gmail_token_expiry', '0'),
    setConfig('gmail_user', ''),
  ]);
}

// ── Draft creation ─────────────────────────────────────────────────────────────

function buildRawMessage({ from, to, subject, body, inReplyTo, references }) {
  const fromName = from.name ? `"${from.name}" <${from.email}>` : from.email;
  const headers = [
    `From: ${fromName}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
  ];
  if (inReplyTo) headers.push(`In-Reply-To: <${inReplyTo}>`);
  if (references) headers.push(`References: <${references}>`);
  const raw = headers.join('\r\n') + '\r\n\r\n' + body;
  return Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function createDraft({ to, subject, body, threadId = null, inReplyTo = null, references = null }) {
  const auth = await getAuthorizedClient();
  const gmail = google.gmail({ version: 'v1', auth });
  const fromName = await getConfig('from_name') || 'SDR';
  const fromEmail = await getConfig('gmail_user') || '';

  const raw = buildRawMessage({ from: { name: fromName, email: fromEmail }, to, subject, body, inReplyTo, references });
  const resource = { message: { raw } };
  if (threadId) resource.message.threadId = threadId;

  const draft = await gmail.users.drafts.create({ userId: 'me', requestBody: resource });
  const draftId = draft.data.id;

  // Get the message ID and thread ID from the created draft
  const draftDetails = await gmail.users.drafts.get({ userId: 'me', id: draftId, format: 'metadata', metadataHeaders: ['Message-ID'] });
  const msgId = draftDetails.data.message?.id;
  const tId = draftDetails.data.message?.threadId;
  const messageId = draftDetails.data.message?.payload?.headers?.find(h => h.name === 'Message-ID')?.value?.replace(/[<>]/g, '');

  return { draftId, threadId: tId || threadId, messageId };
}

async function getDraftById(gmailDraftId) {
  const auth = await getAuthorizedClient();
  const gmail = google.gmail({ version: 'v1', auth });
  try {
    const res = await gmail.users.drafts.get({ userId: 'me', id: gmailDraftId });
    return res.data;
  } catch (e) {
    if (e.code === 404 || e.status === 404) return null;
    throw e;
  }
}

// ── Reply polling ──────────────────────────────────────────────────────────────

async function pollForReplies() {
  const db = getDb();

  const activeDrafts = await new Promise((resolve) => {
    db.all(
      `SELECT id, gmail_draft_id, gmail_thread_id, company_name, subject, contact_email, contact_name, touch_number
       FROM agent_drafts
       WHERE gmail_thread_id IS NOT NULL AND status IN ('draft', 'sent')`,
      [],
      (err, rows) => resolve(rows || [])
    );
  });

  db.close();
  if (!activeDrafts.length) return { checked: 0, replies: 0, updates: 0 };

  let auth;
  try { auth = await getAuthorizedClient(); }
  catch { return { checked: 0, replies: 0, updates: 0, error: 'Gmail not connected' }; }

  const gmail = google.gmail({ version: 'v1', auth });
  let replies = 0, updates = 0;

  for (const draft of activeDrafts) {
    try {
      // Check if thread has replies
      const thread = await gmail.users.threads.get({
        userId: 'me', id: draft.gmail_thread_id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date', 'Message-ID'],
      });
      const messages = thread.data.messages || [];

      if (messages.length > 1 && draft.status !== 'replied') {
        // A reply exists — fetch full content of last message
        const lastMsg = messages[messages.length - 1];
        let replyBody = '';
        try {
          const fullMsg = await gmail.users.messages.get({ userId: 'me', id: lastMsg.id, format: 'full' });
          replyBody = extractTextFromPayload(fullMsg.data.payload);
        } catch {}

        const db2 = getDb();
        db2.run(
          `UPDATE agent_drafts SET status='replied', replied_at=datetime('now'), reply_body=? WHERE id=?`,
          [replyBody.slice(0, 2000), draft.id]
        );
        db2.close();
        replies++;
      }

      // Check if draft was deleted/sent from Gmail (only for status='draft')
      if (draft.status === 'draft' && draft.gmail_draft_id) {
        const stillExists = await getDraftById(draft.gmail_draft_id);
        if (!stillExists) {
          // Draft gone — sent if thread has outgoing messages, deleted otherwise
          const newStatus = messages.length > 1 ? 'sent' : 'deleted';
          const db2 = getDb();
          db2.run(
            `UPDATE agent_drafts SET status=?, sent_at=CASE WHEN ? = 'sent' THEN datetime('now') ELSE sent_at END WHERE id=?`,
            [newStatus, newStatus, draft.id]
          );
          db2.close();
          updates++;
        }
      }
    } catch (e) {
      console.error(`Poll error for draft ${draft.id}:`, e.message);
    }

    // Small delay between Gmail API calls to stay within quota
    await new Promise(r => setTimeout(r, 200));
  }

  return { checked: activeDrafts.length, replies, updates };
}

function extractTextFromPayload(payload) {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf8');
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractTextFromPayload(part);
      if (text) return text;
    }
  }
  return '';
}

module.exports = { startOAuth, handleOAuthCallback, getOAuthStatus, disconnect, createDraft, getDraftById, pollForReplies, getConfig, setConfig };
