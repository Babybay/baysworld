/**
 * Activity Log Service — tracks all admin actions.
 */
const pool = require('./db');

const LogService = {
    /**
     * Log an activity.
     * @param {string} action - e.g. 'create', 'update', 'delete', 'login', 'register'
     * @param {string} entityType - e.g. 'project', 'note', 'admin'
     * @param {string} entityId - UUID of the entity
     * @param {string} entityName - human-readable name
     * @param {string} username - who performed the action
     * @param {string} details - extra info
     * @param {string} ip - IP address
     */
    async log(action, entityType, entityId, entityName, username, details = '', ip = '') {
        try {
            await pool.query(
                `INSERT INTO activity_logs (action, entity_type, entity_id, entity_name, username, details, ip_address)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [action, entityType, entityId, entityName, username, details, ip]
            );
        } catch (err) {
            console.error('Failed to write activity log:', err.message);
        }
    },

    /**
     * Get recent activity logs.
     */
    async getLogs(limit = 50, offset = 0) {
        const { rows } = await pool.query(
            'SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2',
            [limit, offset]
        );
        return rows.map(r => ({
            id: r.id,
            action: r.action,
            entityType: r.entity_type,
            entityId: r.entity_id,
            entityName: r.entity_name,
            username: r.username,
            details: r.details,
            ipAddress: r.ip_address,
            createdAt: r.created_at,
        }));
    },

    /**
     * Get total log count.
     */
    async getCount() {
        const { rows } = await pool.query('SELECT COUNT(*) as count FROM activity_logs');
        return parseInt(rows[0].count);
    },
};

module.exports = LogService;
