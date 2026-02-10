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
  console.log(`[ACTION] Stop App requested for ID: ${id}`);

  const result = await pool.query(
    'SELECT container_name FROM apps WHERE id=$1',
    [id]
  );

  if (result.rowCount === 0) {
    console.warn(`[ACTION] App ${id} not found`);
    return res.status(404).json({ error: 'App not found' });
  }

  const container = result.rows[0].container_name;

  if (!container) {
    console.warn(`[ACTION] App ${id} not running`);
    return res.status(400).json({ error: 'App is not running' });
  }

  const stop = spawnSync('docker', ['stop', container]);

  if (stop.status !== 0) {
    console.error(`[ACTION] Failed to stop container ${container}`);
    return res.status(500).json({ error: 'Failed to stop container' });
  }

  await pool.query(
    'UPDATE apps SET status=$1 WHERE id=$2',
    ['stopped', id]
  );
  console.log(`[ACTION] App ${id} stopped successfully`);
  res.redirect('/');

  // res.json({ message: 'App stopped', id });
};


// START APP --------------------------------------------------------------
exports.startApp = async (req, res) => {
  const appId = req.params.id;
  console.log(`[ACTION] Start App requested for ID: ${appId}`);

  const result = await pool.query(
    'SELECT container_name, status FROM apps WHERE id=$1',
    [appId]
  );

  if (result.rowCount === 0) {
    console.warn(`[ACTION] App ${appId} not found`);
    return res.status(404).json({ error: 'App not found' });
  }

  const { container_name, status } = result.rows[0];

  if (status !== 'stopped') {
    console.warn(`[ACTION] App ${appId} is not in stopped state (status: ${status})`);
    return res.status(400).json({ error: 'App is not stopped' });
  }

  const start = spawnSync('docker', ['start', container_name]);

  if (start.status !== 0) {
    console.error(`[ACTION] Failed to start container ${container_name}`);
    return res.status(500).json({ error: 'Failed to start container' });
  }

  await pool.query(
    'UPDATE apps SET status=$1 WHERE id=$2',
    ['running', appId]
  );
  console.log(`[ACTION] App ${appId} started successfully`);
  res.redirect('/');

  // res.json({ message: 'App started', appId });
};


// DELETE APP ----------------------------------------------------
exports.deleteApp = async (req, res) => {
  const appId = req.params.id;
  console.log(`[ACTION] Delete App requested for ID: ${appId}`);

  const result = await pool.query(
    'SELECT container_name, image_name FROM apps WHERE id=$1',
    [appId]
  );

  if (result.rowCount === 0) {
    console.warn(`[ACTION] App ${appId} not found for deletion`);
    return res.status(404).json({ error: 'App not found' });
  }

  const { container_name, image_name } = result.rows[0];

  if (container_name) {
    console.log(`[ACTION] Removing container ${container_name}`);
    spawnSync('docker', ['rm', '-f', container_name]);
  }

  if (image_name) {
    console.log(`[ACTION] Removing image ${image_name}`);
    spawnSync('docker', ['rmi', '-f', image_name]);
  }

  await pool.query('DELETE FROM apps WHERE id=$1', [appId]);
  console.log(`[ACTION] App ${appId} deleted from DB`);

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
  console.log(`[ACTION] Get build logs for ID: ${req.params.id}`);
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
  console.log(`[ACTION] Rename App requested for ID: ${id} -> Name: ${name}`);

  if (!name || name.trim() === '') {
    return res.redirect('/');
  }

  await pool.query(
    'UPDATE apps SET name=$1 WHERE id=$2',
    [name.trim(), id]
  );
  console.log(`[ACTION] App ${id} renamed to ${name}`);

  res.redirect('/');
};




