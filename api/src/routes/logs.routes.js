/**
 * Activity Logs Routes — admin-only access to system logs.
 */
const { Router } = require('express');
const LogService = require('../services/log.service');
const r = Router();

// GET /api/logs — paginated activity logs
r.get('/', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const offset = parseInt(req.query.offset) || 0;
        const [logs, total] = await Promise.all([
            LogService.getLogs(limit, offset),
            LogService.getCount(),
        ]);
        res.json({ logs, total, limit, offset });
    } catch (err) {
        console.error('Error fetching logs:', err);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

module.exports = r;
