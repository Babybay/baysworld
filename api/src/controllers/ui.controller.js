const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'baysworld',
  password: 'babybay',
  port: 5433,
});

exports.dashboard = async (req, res) => {
  const result = await pool.query(
    `SELECT id, status, created_at
     FROM apps
     ORDER BY created_at DESC`
  );

  res.render('dashboard', {
    apps: result.rows,
  });
};
