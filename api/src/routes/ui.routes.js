const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const IORedis = require('ioredis');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'baysworld',
    password: 'babybay',
    port: 5433,
});

const redis = new IORedis({
    host: 'localhost',
    port: 6379,
});

router.get('/', async (req, res) => {
    let dbStatus = 'offline';
    let buildStatus = 'offline';
    let runtimeStatus = 'offline';

    try {
        await pool.query('SELECT 1');
        dbStatus = 'running';
    } catch (e) {
        dbStatus = 'failed';
    }

    try {
        const [build, runtime] = await redis.mget('status:worker-build', 'status:worker-runtime');
        buildStatus = build ? 'running' : 'offline';
        runtimeStatus = runtime ? 'running' : 'offline';
    } catch (e) {
        console.error('Redis check failed', e);
    }

    const result = await pool.query(
        'SELECT id, name, status FROM apps ORDER BY created_at DESC'
    );

    res.render('dashboard', {
        apps: result.rows,
        systemStatus: {
            database: dbStatus,
            workerBuild: buildStatus,
            workerRuntime: runtimeStatus,
            api: 'running'
        }
    });
});

module.exports = router;
