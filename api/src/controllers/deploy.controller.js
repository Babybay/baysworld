const { buildQueue } = require('../services/queue.service');
const AdmZip = require('adm-zip');
const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'baysworld',
  password: 'babybay',
  port: 5433,
});

exports.deployApp = async (req, res) => {
  try {
    const zipPath = req.file.path;

    const appId = Date.now();
    const userId = 1;

    const quota = await pool.query(
      `SELECT COUNT(*) FROM apps
   WHERE user_id=$1 AND status NOT IN ('deleted')`,
      [userId]
    );

    if (parseInt(quota.rows[0].count) >= 5) {
      return res.status(403).json({
        error: 'App quota exceeded (max 5 apps)',
      });
    }

    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();

    const forbidden = ['Dockerfile', '.env', '.ssh', '.git'];

    for (const entry of entries) {
      for (const bad of forbidden) {
        if (entry.entryName.includes(bad)) {
          return res.status(400).json({
            error: `Forbidden file detected: ${bad}`,
          });
        }
      }
    }

    // enqueue job
    await buildQueue.add('build-app', {
      appId,
      userId,
      zipPath,
    });

    console.log(`[ACTION] Deploy App: Uploaded ${zipPath} for User ${userId}, App ID ${appId}`);

    await pool.query(
      `INSERT INTO apps (id, user_id, status)
       VALUES ($1, $2, 'queued')`,
      [appId, userId]
    );

    return res.status(202).json({
      message: 'App queued for build',
      appId,
      status: 'queued',
    });

  } catch (err) {
    console.error('DEPLOY ERROR:', err);
    res.status(500).json({ error: 'Deploy failed' });
  }
};
