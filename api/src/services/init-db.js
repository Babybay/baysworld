/**
 * Database initialization — creates tables if they don't exist.
 */
const pool = require('./db');
const bcrypt = require('bcryptjs');

async function initDB() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Projects table
        await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT DEFAULT '',
        tech_stack TEXT[] DEFAULT '{}',
        status VARCHAR(50) DEFAULT 'active',
        github_url VARCHAR(500) DEFAULT '',
        live_url VARCHAR(500) DEFAULT '',
        tags TEXT[] DEFAULT '{}',
        notes TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

        // Notes table
        await client.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        content TEXT DEFAULT '',
        category VARCHAR(100) DEFAULT 'General',
        tags TEXT[] DEFAULT '{}',
        pinned BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

        // Admin table
        await client.query(`
      CREATE TABLE IF NOT EXISTS admin (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

        // Create default admin if table is empty
        const { rows } = await client.query('SELECT COUNT(*) as count FROM admin');
        if (parseInt(rows[0].count) === 0) {
            const hash = bcrypt.hashSync('admin123', 10);
            await client.query(
                'INSERT INTO admin (username, password_hash) VALUES ($1, $2)',
                ['admin', hash]
            );
            console.log('═══════════════════════════════════════════');
            console.log('  ⚠  Default admin account created!');
            console.log('  Username: admin');
            console.log('  Password: admin123');
            console.log('  ⚠  Change this password after first login!');
            console.log('═══════════════════════════════════════════');
        }

        await client.query('COMMIT');
        console.log('✅ Database tables initialized');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Database init failed:', err.message);
        throw err;
    } finally {
        client.release();
    }
}

module.exports = initDB;
