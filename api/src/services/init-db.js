/**
 * Database initialization — creates tables if they don't exist.
 * Includes slug columns and activity_logs table.
 */
const pool = require('./db');
const bcrypt = require('bcryptjs');

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Projects table (with slug, thumbnail, images)
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE,
        description TEXT DEFAULT '',
        tech_stack TEXT[] DEFAULT '{}',
        status VARCHAR(50) DEFAULT 'active',
        github_url VARCHAR(500) DEFAULT '',
        live_url VARCHAR(500) DEFAULT '',
        tags TEXT[] DEFAULT '{}',
        notes TEXT DEFAULT '',
        thumbnail VARCHAR(500) DEFAULT '',
        images TEXT[] DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Notes table (with slug)
    await client.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE,
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

    // Activity logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        action VARCHAR(50) NOT NULL,
        entity_type VARCHAR(50),
        entity_id VARCHAR(255),
        entity_name VARCHAR(255),
        username VARCHAR(100),
        details TEXT,
        ip_address VARCHAR(45),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Add slug column to projects if missing (migration)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='slug') THEN
          ALTER TABLE projects ADD COLUMN slug VARCHAR(255) UNIQUE;
        END IF;
      END $$;
    `);

    // Add thumbnail column to projects if missing (migration)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='thumbnail') THEN
          ALTER TABLE projects ADD COLUMN thumbnail VARCHAR(500) DEFAULT '';
        END IF;
      END $$;
    `);

    // Add images column to projects if missing (migration)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='images') THEN
          ALTER TABLE projects ADD COLUMN images TEXT[] DEFAULT '{}';
        END IF;
      END $$;
    `);

    // Add slug column to notes if missing (migration)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notes' AND column_name='slug') THEN
          ALTER TABLE notes ADD COLUMN slug VARCHAR(255) UNIQUE;
        END IF;
      END $$;
    `);

    // Generate slugs for existing rows that don't have one
    const { rows: projectsNoSlug } = await client.query("SELECT id, name FROM projects WHERE slug IS NULL OR slug = ''");
    for (const p of projectsNoSlug) {
      const slug = slugify(p.name);
      const unique = await makeUniqueSlug(client, 'projects', slug);
      await client.query('UPDATE projects SET slug = $1 WHERE id = $2', [unique, p.id]);
    }

    const { rows: notesNoSlug } = await client.query("SELECT id, title FROM notes WHERE slug IS NULL OR slug = ''");
    for (const n of notesNoSlug) {
      const slug = slugify(n.title);
      const unique = await makeUniqueSlug(client, 'notes', slug);
      await client.query('UPDATE notes SET slug = $1 WHERE id = $2', [unique, n.id]);
    }

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
    console.log('✅ Database tables initialized (with slugs + activity_logs)');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Database init failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

// ── Slug helpers ──

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')   // remove special chars
    .replace(/[\s_]+/g, '-')     // spaces/underscores → hyphens
    .replace(/-+/g, '-')         // collapse multiple hyphens
    .replace(/^-+|-+$/g, '')     // trim hyphens
    .slice(0, 200) || 'untitled';
}

async function makeUniqueSlug(client, table, slug) {
  let candidate = slug;
  let counter = 0;
  while (true) {
    const { rows } = await client.query(
      `SELECT id FROM ${table} WHERE slug = $1 LIMIT 1`,
      [candidate]
    );
    if (!rows.length) return candidate;
    counter++;
    candidate = `${slug}-${counter}`;
  }
}

module.exports = initDB;
module.exports.slugify = slugify;
