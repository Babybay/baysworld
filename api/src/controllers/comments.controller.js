/**
 * Comments Controller — visitor comments on projects/notes.
 */
const pool = require('../services/db');

const CommentsController = {
    /**
     * GET /api/comments/:entityType/:entityId — get approved comments (public)
     */
    async getComments(req, res) {
        try {
            const { entityType, entityId } = req.params;
            const { rows } = await pool.query(
                `SELECT id, author_name, content, created_at FROM comments
         WHERE entity_type = $1 AND entity_id = $2 AND approved = true
         ORDER BY created_at DESC`,
                [entityType, entityId]
            );
            res.json(rows.map(r => ({
                id: r.id,
                authorName: r.author_name,
                content: r.content,
                createdAt: r.created_at,
            })));
        } catch (err) {
            res.status(500).json({ error: 'Failed to fetch comments' });
        }
    },

    /**
     * POST /api/comments/:entityType/:entityId — submit a comment (public, pending approval)
     */
    async addComment(req, res) {
        try {
            const { entityType, entityId } = req.params;
            const { authorName, authorEmail, content } = req.body;

            if (!authorName || !content) {
                return res.status(400).json({ error: 'Name and comment are required' });
            }
            if (content.length > 2000) {
                return res.status(400).json({ error: 'Comment too long (max 2000 chars)' });
            }

            const { rows } = await pool.query(
                `INSERT INTO comments (entity_type, entity_id, author_name, author_email, content)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
                [entityType, entityId, authorName.slice(0, 100), (authorEmail || '').slice(0, 255), content.slice(0, 2000)]
            );

            res.status(201).json({
                id: rows[0].id,
                message: 'Comment submitted! It will appear after admin approval.',
                createdAt: rows[0].created_at,
            });
        } catch (err) {
            console.error('Add comment error:', err.message);
            res.status(500).json({ error: 'Failed to submit comment' });
        }
    },

    /**
     * GET /api/comments/pending — list pending comments (admin only)
     */
    async getPending(req, res) {
        try {
            const { rows } = await pool.query(
                `SELECT c.id, c.entity_type, c.entity_id, c.author_name, c.author_email, c.content, c.created_at,
                CASE WHEN c.entity_type = 'project' THEN p.name ELSE n.title END as entity_name
         FROM comments c
         LEFT JOIN projects p ON c.entity_type = 'project' AND c.entity_id = p.id
         LEFT JOIN notes n ON c.entity_type = 'note' AND c.entity_id = n.id
         WHERE c.approved = false
         ORDER BY c.created_at DESC`
            );
            res.json(rows.map(r => ({
                id: r.id,
                entityType: r.entity_type,
                entityId: r.entity_id,
                entityName: r.entity_name,
                authorName: r.author_name,
                authorEmail: r.author_email,
                content: r.content,
                createdAt: r.created_at,
            })));
        } catch (err) {
            res.status(500).json({ error: 'Failed to fetch pending comments' });
        }
    },

    /**
     * PUT /api/comments/:id/approve — approve a comment (admin only)
     */
    async approve(req, res) {
        try {
            const { id } = req.params;
            await pool.query('UPDATE comments SET approved = true WHERE id = $1', [id]);
            res.json({ message: 'Comment approved' });
        } catch (err) {
            res.status(500).json({ error: 'Failed to approve comment' });
        }
    },

    /**
     * DELETE /api/comments/:id — delete a comment (admin only)
     */
    async remove(req, res) {
        try {
            const { id } = req.params;
            await pool.query('DELETE FROM comments WHERE id = $1', [id]);
            res.json({ message: 'Comment deleted' });
        } catch (err) {
            res.status(500).json({ error: 'Failed to delete comment' });
        }
    },
};

module.exports = CommentsController;
