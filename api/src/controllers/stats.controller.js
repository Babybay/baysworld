/**
 * Stats Controller — page view tracking and analytics dashboard.
 */
const pool = require('../services/db');

const StatsController = {
    /**
     * POST /api/stats/view — record a page view (public)
     */
    async recordView(req, res) {
        try {
            const { entityType, entityId } = req.body;
            if (!entityType) return res.status(400).json({ error: 'entityType required' });

            const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
            const userAgent = req.headers['user-agent'] || '';
            const referrer = req.headers.referer || '';

            await pool.query(
                `INSERT INTO page_views (entity_type, entity_id, ip_address, user_agent, referrer) VALUES ($1, $2, $3, $4, $5)`,
                [entityType, entityId || null, ip, userAgent, referrer]
            );

            res.json({ ok: true });
        } catch (err) {
            console.error('Record view error:', err.message);
            res.status(500).json({ error: 'Failed to record view' });
        }
    },

    /**
     * GET /api/stats/public — public view counts
     */
    async getPublicStats(req, res) {
        try {
            const [totalViews, todayViews] = await Promise.all([
                pool.query('SELECT COUNT(*) as count FROM page_views'),
                pool.query("SELECT COUNT(*) as count FROM page_views WHERE created_at >= CURRENT_DATE"),
            ]);

            res.json({
                totalViews: parseInt(totalViews.rows[0].count),
                todayViews: parseInt(todayViews.rows[0].count),
            });
        } catch (err) {
            res.status(500).json({ error: 'Failed to fetch stats' });
        }
    },

    /**
     * GET /api/stats — full analytics dashboard (admin only)
     */
    async getDashboard(req, res) {
        try {
            const [
                totalViews,
                todayViews,
                weekViews,
                topProjects,
                topNotes,
                categoryEngagement,
                recentViewsByDay,
                pendingComments,
                totalComments,
                totalSubscribers,
            ] = await Promise.all([
                pool.query('SELECT COUNT(*) as count FROM page_views'),
                pool.query("SELECT COUNT(*) as count FROM page_views WHERE created_at >= CURRENT_DATE"),
                pool.query("SELECT COUNT(*) as count FROM page_views WHERE created_at >= NOW() - INTERVAL '7 days'"),
                // Top 5 most viewed projects
                pool.query(`
          SELECT pv.entity_id, p.name, COUNT(*) as views
          FROM page_views pv
          JOIN projects p ON p.id = pv.entity_id
          WHERE pv.entity_type = 'project' AND pv.entity_id IS NOT NULL
          GROUP BY pv.entity_id, p.name
          ORDER BY views DESC LIMIT 5
        `),
                // Top 5 most viewed notes
                pool.query(`
          SELECT pv.entity_id, n.title as name, COUNT(*) as views
          FROM page_views pv
          JOIN notes n ON n.id = pv.entity_id
          WHERE pv.entity_type = 'note' AND pv.entity_id IS NOT NULL
          GROUP BY pv.entity_id, n.title
          ORDER BY views DESC LIMIT 5
        `),
                // Category engagement (note views grouped by category)
                pool.query(`
          SELECT n.category, COUNT(pv.id) as views
          FROM page_views pv
          JOIN notes n ON n.id = pv.entity_id
          WHERE pv.entity_type = 'note' AND pv.entity_id IS NOT NULL
          GROUP BY n.category
          ORDER BY views DESC
        `),
                // Views per day (last 14 days)
                pool.query(`
          SELECT DATE(created_at) as day, COUNT(*) as views
          FROM page_views
          WHERE created_at >= NOW() - INTERVAL '14 days'
          GROUP BY DATE(created_at)
          ORDER BY day ASC
        `),
                pool.query("SELECT COUNT(*) as count FROM comments WHERE approved = false"),
                pool.query("SELECT COUNT(*) as count FROM comments"),
                pool.query("SELECT COUNT(*) as count FROM email_subscriptions WHERE active = true"),
            ]);

            res.json({
                totalViews: parseInt(totalViews.rows[0].count),
                todayViews: parseInt(todayViews.rows[0].count),
                weekViews: parseInt(weekViews.rows[0].count),
                topProjects: topProjects.rows.map(r => ({ id: r.entity_id, name: r.name, views: parseInt(r.views) })),
                topNotes: topNotes.rows.map(r => ({ id: r.entity_id, name: r.name, views: parseInt(r.views) })),
                categoryEngagement: categoryEngagement.rows.map(r => ({ category: r.category, views: parseInt(r.views) })),
                recentViewsByDay: recentViewsByDay.rows.map(r => ({ day: r.day, views: parseInt(r.views) })),
                pendingComments: parseInt(pendingComments.rows[0].count),
                totalComments: parseInt(totalComments.rows[0].count),
                totalSubscribers: parseInt(totalSubscribers.rows[0].count),
            });
        } catch (err) {
            console.error('Stats dashboard error:', err.message);
            res.status(500).json({ error: 'Failed to fetch dashboard stats' });
        }
    },
};

module.exports = StatsController;
