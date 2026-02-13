/**
 * Subscriptions Controller — email notification opt-in.
 */
const pool = require('../services/db');

const SubscriptionsController = {
    /**
     * POST /api/subscribe — add email subscription (public)
     */
    async subscribe(req, res) {
        try {
            const { email, name } = req.body;
            if (!email || !email.includes('@')) {
                return res.status(400).json({ error: 'Valid email is required' });
            }

            await pool.query(
                `INSERT INTO email_subscriptions (email, name)
         VALUES ($1, $2)
         ON CONFLICT (email) DO UPDATE SET active = true, name = COALESCE(NULLIF($2, ''), email_subscriptions.name)`,
                [email.toLowerCase().trim(), (name || '').slice(0, 100)]
            );

            res.status(201).json({ message: 'Subscribed! You will receive notifications for new content.' });
        } catch (err) {
            console.error('Subscribe error:', err.message);
            res.status(500).json({ error: 'Failed to subscribe' });
        }
    },

    /**
     * DELETE /api/unsubscribe/:email — unsubscribe (public)
     */
    async unsubscribe(req, res) {
        try {
            const { email } = req.params;
            await pool.query('UPDATE email_subscriptions SET active = false WHERE email = $1', [email.toLowerCase()]);
            res.json({ message: 'Unsubscribed successfully' });
        } catch (err) {
            res.status(500).json({ error: 'Failed to unsubscribe' });
        }
    },

    /**
     * GET /api/subscriptions — list all subscribers (admin only)
     */
    async list(req, res) {
        try {
            const { rows } = await pool.query(
                'SELECT id, email, name, notify_new_project, notify_new_note, active, created_at FROM email_subscriptions ORDER BY created_at DESC'
            );
            res.json(rows.map(r => ({
                id: r.id,
                email: r.email,
                name: r.name,
                notifyNewProject: r.notify_new_project,
                notifyNewNote: r.notify_new_note,
                active: r.active,
                createdAt: r.created_at,
            })));
        } catch (err) {
            res.status(500).json({ error: 'Failed to fetch subscriptions' });
        }
    },
};

module.exports = SubscriptionsController;
