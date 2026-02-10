const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'baysworld',
    password: 'babybay',
    port: 5433,
});

router.get('/', async (req, res) => {
    const result = await pool.query(
        'SELECT id, name, status FROM apps ORDER BY created_at DESC'
    );

    res.render('dashboard', {
        apps: result.rows,
    });
});

module.exports = router;
