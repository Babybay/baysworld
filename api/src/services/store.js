/**
 * Store module — PostgreSQL-backed CRUD operations.
 * Supports slug-based lookups and auto-slug generation.
 */
const pool = require('./db');
const { slugify } = require('./init-db');

const Store = {
    // ── Projects ────────────────────────────────────────

    async getAllProjects({ status, tag, q } = {}) {
        let query = 'SELECT * FROM projects';
        const params = [];
        const conditions = [];

        if (status) {
            params.push(status);
            conditions.push(`status = $${params.length}`);
        }
        if (tag) {
            params.push(tag);
            conditions.push(`$${params.length} = ANY(tags)`);
        }
        if (q) {
            params.push(`%${q.toLowerCase()}%`);
            const idx = params.length;
            conditions.push(`(LOWER(name) LIKE $${idx} OR LOWER(description) LIKE $${idx})`);
        }

        if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
        query += ' ORDER BY updated_at DESC';

        const { rows } = await pool.query(query, params);
        return rows.map(mapProject);
    },

    async getProject(id) {
        const { rows } = await pool.query('SELECT * FROM projects WHERE id = $1', [id]);
        return rows.length ? mapProject(rows[0]) : null;
    },

    async getProjectBySlug(slug) {
        const { rows } = await pool.query('SELECT * FROM projects WHERE slug = $1', [slug]);
        return rows.length ? mapProject(rows[0]) : null;
    },

    async createProject(data) {
        const slug = await generateUniqueSlug('projects', data.name);
        const { rows } = await pool.query(
            `INSERT INTO projects (name, slug, description, tech_stack, status, github_url, live_url, tags, notes, thumbnail, images)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
            [data.name, slug, data.description || '', data.techStack || [], data.status || 'active',
            data.githubUrl || '', data.liveUrl || '', data.tags || [], data.notes || '',
            data.thumbnail || '', data.images || []]
        );
        return mapProject(rows[0]);
    },

    async updateProject(id, data) {
        const fields = [];
        const params = [];
        let idx = 1;

        if (data.name !== undefined) {
            fields.push(`name = $${idx++}`); params.push(data.name);
            // Regenerate slug when name changes
            const slug = await generateUniqueSlug('projects', data.name, id);
            fields.push(`slug = $${idx++}`); params.push(slug);
        }
        if (data.description !== undefined) { fields.push(`description = $${idx++}`); params.push(data.description); }
        if (data.techStack !== undefined) { fields.push(`tech_stack = $${idx++}`); params.push(data.techStack); }
        if (data.status !== undefined) { fields.push(`status = $${idx++}`); params.push(data.status); }
        if (data.githubUrl !== undefined) { fields.push(`github_url = $${idx++}`); params.push(data.githubUrl); }
        if (data.liveUrl !== undefined) { fields.push(`live_url = $${idx++}`); params.push(data.liveUrl); }
        if (data.tags !== undefined) { fields.push(`tags = $${idx++}`); params.push(data.tags); }
        if (data.notes !== undefined) { fields.push(`notes = $${idx++}`); params.push(data.notes); }
        if (data.thumbnail !== undefined) { fields.push(`thumbnail = $${idx++}`); params.push(data.thumbnail); }
        if (data.images !== undefined) { fields.push(`images = $${idx++}`); params.push(data.images); }

        fields.push(`updated_at = NOW()`);
        params.push(id);

        const { rows } = await pool.query(
            `UPDATE projects SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
            params
        );
        return rows.length ? mapProject(rows[0]) : null;
    },

    async deleteProject(id) {
        const { rowCount } = await pool.query('DELETE FROM projects WHERE id = $1', [id]);
        return rowCount > 0;
    },

    // ── Media helpers ────────────────────────────────────

    async addProjectImage(id, url) {
        await pool.query(
            'UPDATE projects SET images = array_append(images, $1), updated_at = NOW() WHERE id = $2',
            [url, id]
        );
    },

    async removeProjectImage(id, url) {
        await pool.query(
            'UPDATE projects SET images = array_remove(images, $1), updated_at = NOW() WHERE id = $2',
            [url, id]
        );
    },

    async setProjectThumbnail(id, url) {
        await pool.query(
            'UPDATE projects SET thumbnail = $1, updated_at = NOW() WHERE id = $2',
            [url, id]
        );
    },

    // ── Notes ───────────────────────────────────────────

    async getAllNotes({ category, tag, q } = {}) {
        let query = 'SELECT * FROM notes';
        const params = [];
        const conditions = [];

        if (category) {
            params.push(category);
            conditions.push(`category = $${params.length}`);
        }
        if (tag) {
            params.push(tag);
            conditions.push(`$${params.length} = ANY(tags)`);
        }
        if (q) {
            params.push(`%${q.toLowerCase()}%`);
            const idx = params.length;
            conditions.push(`(LOWER(title) LIKE $${idx} OR LOWER(content) LIKE $${idx})`);
        }

        if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
        query += ' ORDER BY pinned DESC, updated_at DESC';

        const { rows } = await pool.query(query, params);
        return rows.map(mapNote);
    },

    async getNote(id) {
        const { rows } = await pool.query('SELECT * FROM notes WHERE id = $1', [id]);
        return rows.length ? mapNote(rows[0]) : null;
    },

    async getNoteBySlug(slug) {
        const { rows } = await pool.query('SELECT * FROM notes WHERE slug = $1', [slug]);
        return rows.length ? mapNote(rows[0]) : null;
    },

    async createNote(data) {
        const slug = await generateUniqueSlug('notes', data.title);
        const { rows } = await pool.query(
            `INSERT INTO notes (title, slug, content, category, tags, pinned)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
            [data.title, slug, data.content || '', data.category || 'General',
            data.tags || [], data.pinned || false]
        );
        return mapNote(rows[0]);
    },

    async updateNote(id, data) {
        const fields = [];
        const params = [];
        let idx = 1;

        if (data.title !== undefined) {
            fields.push(`title = $${idx++}`); params.push(data.title);
            const slug = await generateUniqueSlug('notes', data.title, id);
            fields.push(`slug = $${idx++}`); params.push(slug);
        }
        if (data.content !== undefined) { fields.push(`content = $${idx++}`); params.push(data.content); }
        if (data.category !== undefined) { fields.push(`category = $${idx++}`); params.push(data.category); }
        if (data.tags !== undefined) { fields.push(`tags = $${idx++}`); params.push(data.tags); }
        if (data.pinned !== undefined) { fields.push(`pinned = $${idx++}`); params.push(data.pinned); }

        fields.push(`updated_at = NOW()`);
        params.push(id);

        const { rows } = await pool.query(
            `UPDATE notes SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
            params
        );
        return rows.length ? mapNote(rows[0]) : null;
    },

    async deleteNote(id) {
        const { rowCount } = await pool.query('DELETE FROM notes WHERE id = $1', [id]);
        return rowCount > 0;
    },

    async getCategories() {
        const { rows } = await pool.query(
            'SELECT DISTINCT category FROM notes WHERE category IS NOT NULL ORDER BY category'
        );
        return rows.map(r => r.category);
    },
};

// ── Slug generator ──

async function generateUniqueSlug(table, text, excludeId = null) {
    const base = slugify(text);
    let candidate = base;
    let counter = 0;
    while (true) {
        let query = `SELECT id FROM ${table} WHERE slug = $1`;
        const params = [candidate];
        if (excludeId) {
            query += ' AND id != $2';
            params.push(excludeId);
        }
        query += ' LIMIT 1';
        const { rows } = await pool.query(query, params);
        if (!rows.length) return candidate;
        counter++;
        candidate = `${base}-${counter}`;
    }
}

// ── Mappers: snake_case → camelCase ──

function mapProject(row) {
    return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        techStack: row.tech_stack || [],
        status: row.status,
        githubUrl: row.github_url,
        liveUrl: row.live_url,
        tags: row.tags || [],
        notes: row.notes,
        thumbnail: row.thumbnail || '',
        images: row.images || [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function mapNote(row) {
    return {
        id: row.id,
        title: row.title,
        slug: row.slug,
        content: row.content,
        category: row.category,
        tags: row.tags || [],
        pinned: row.pinned,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

module.exports = Store;
