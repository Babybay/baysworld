const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'baysworld-secret-key-change-in-production-2026';
const JWT_EXPIRY = '24h';

async function getAdmin() {
    const { rows } = await pool.query('SELECT * FROM admin ORDER BY id LIMIT 1');
    return rows.length ? rows[0] : null;
}

async function saveAdmin(data) {
    await pool.query(
        'UPDATE admin SET password_hash = $1, updated_at = NOW() WHERE username = $2',
        [data.passwordHash, data.username]
    );
}

function verifyPassword(plain, hash) {
    return bcrypt.compareSync(plain, hash);
}

function hashPassword(plain) {
    return bcrypt.hashSync(plain, 10);
}

function generateToken(username) {
    return jwt.sign({ username, role: 'admin' }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch {
        return null;
    }
}

module.exports = {
    getAdmin,
    saveAdmin,
    verifyPassword,
    hashPassword,
    generateToken,
    verifyToken,
};
