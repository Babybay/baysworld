const { Pool } = require('pg');
const { spawnSync } = require('child_process');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'baysworld',
  password: 'babybay',
  port: 5433,
});


// STOP APP
exports.stopApp = async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    'SELECT container_name FROM apps WHERE id=$1',
    [id]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'App not found' });
  }

  const container = result.rows[0].container_name;

  if (!container) {
    return res.status(400).json({ error: 'App is not running' });
  }

  const stop = spawnSync('docker', ['stop', container]);

  if (stop.status !== 0) {
    return res.status(500).json({ error: 'Failed to stop container' });
  }

  await pool.query(
    'UPDATE apps SET status=$1 WHERE id=$2',
    ['stopped', id]
  );
  res.redirect('/');

  res.json({ message: 'App stopped', id });
};


// START APP --------------------------------------------------------------
exports.startApp = async (req, res) => {
  const appId = req.params.id;

  const result = await pool.query(
    'SELECT container_name, status FROM apps WHERE id=$1',
    [appId]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'App not found' });
  }

  const { container_name, status } = result.rows[0];

  if (status !== 'stopped') {
    return res.status(400).json({ error: 'App is not stopped' });
  }

  const start = spawnSync('docker', ['start', container_name]);

  if (start.status !== 0) {
    return res.status(500).json({ error: 'Failed to start container' });
  }

  await pool.query(
    'UPDATE apps SET status=$1 WHERE id=$2',
    ['running', appId]
  );
  res.redirect('/');

  res.json({ message: 'App started', appId });
};


// DELETE APP ----------------------------------------------------
exports.deleteApp = async (req, res) => {
  const appId = req.params.id;

  const result = await pool.query(
    'SELECT container_name, image_name FROM apps WHERE id=$1',
    [appId]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'App not found' });
  }

  const { container_name, image_name } = result.rows[0];

  if (container_name) {
    spawnSync('docker', ['rm', '-f', container_name]);
  }

  if (image_name) {
    spawnSync('docker', ['rmi', '-f', image_name]);
  }

  await pool.query('DELETE FROM apps WHERE id=$1', [appId]);

  res.json({ message: 'App deleted', appId });
};

// LIST APPS JSON ----------------------------------------------------
exports.listAppsJson = async (req, res) => {
  const result = await pool.query(
    `SELECT id, status
     FROM apps
     ORDER BY created_at DESC`
  );
  res.json(result.rows);
};

// GET BUILD LOGS ----------------------------------------------------
exports.getBuildLogs = async (req, res) => {
  const result = await pool.query(
    `SELECT message, created_at
     FROM build_logs
     WHERE app_id=$1
     ORDER BY created_at ASC`,
    [req.params.id]
  );
  res.json(result.rows);
};

// RENAME APP ----------------------------------------------------
exports.renameApp = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name || name.trim() === '') {
    return res.redirect('/');
  }

  await pool.query(
    'UPDATE apps SET name=$1 WHERE id=$2',
    [name.trim(), id]
  );

  res.redirect('/');
};




