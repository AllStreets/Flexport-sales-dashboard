// backend/cron/agentCron.js
const cron = require('node-cron');
const { runBatch, recalibrateScores } = require('../services/agentService');
const { pollForReplies } = require('../services/gmailService');

// Batch research + draft — Mon–Fri at 08:00 local time
// Set TZ=America/Chicago in your environment for Chicago time
cron.schedule('0 8 * * 1-5', async () => {
  console.log('[agent-cron] Starting scheduled batch research...');
  try {
    const result = await runBatch({ triggeredBy: 'cron' });
    console.log(`[agent-cron] Batch done — drafted:${result.drafted} skipped:${result.skipped} errors:${result.errors}`);
  } catch (e) {
    console.error('[agent-cron] Batch error:', e.message);
  }
});

// Reply polling — every 4 hours
cron.schedule('0 */4 * * *', async () => {
  console.log('[agent-cron] Polling for replies...');
  try {
    const result = await pollForReplies();
    console.log(`[agent-cron] Reply poll done — checked:${result.checked} replies:${result.replies}`);
  } catch (e) {
    console.error('[agent-cron] Poll error:', e.message);
  }
});

// Score recalibration — every Monday at 09:00
cron.schedule('0 9 * * 1', async () => {
  console.log('[agent-cron] Recalibrating sector scores...');
  try {
    const boosts = await recalibrateScores();
    console.log('[agent-cron] Recalibration done:', boosts);
  } catch (e) {
    console.error('[agent-cron] Recalibration error:', e.message);
  }
});

console.log('[agent-cron] Scheduled: batch@08:00 Mon–Fri · reply-poll every 4h · recalibrate Mon@09:00');
