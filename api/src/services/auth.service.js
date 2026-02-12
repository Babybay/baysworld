const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'baysworld-secret-key-change-in-production-2026';
const JWT_EXPIRY = '24h';
const VIP_KEY = process.env.VIP_KEY || 'BAYSWORLD-VIP-2026';

// Find admin by username
async function getAdminByUsername(username) {
    const { rows } = await pool.query('SELECT * FROM admin WHERE username = $1', [username]);
    return rows.length ? rows[0] : null;
}

// Legacy single-admin getter (for backward compat)
async function getAdmin() {
    const { rows } = await pool.query('SELECT * FROM admin ORDER BY id LIMIT 1');
    return rows.length ? rows[0] : null;
}

// Create a new admin account
async function createAdmin(username, password) {
    const hash = bcrypt.hashSync(password, 10);
    const { rows } = await pool.query(
        'INSERT INTO admin (username, password_hash) VALUES ($1, $2) RETURNING *',
        [username, hash]
    );
    return rows[0];
}

// Update admin password
async function saveAdmin(data) {
    await pool.query(
        'UPDATE admin SET password_hash = $1, updated_at = NOW() WHERE username = $2',
        [data.passwordHash, data.username]
    );
}

// Get all admins (for listing)
async function getAllAdmins() {
    const { rows } = await pool.query('SELECT id, username, created_at FROM admin ORDER BY id');
    return rows;
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

function verifyVipKey(key) {
    return key === VIP_KEY;
}

module.exports = {
    getAdmin,
    getAdminByUsername,
    createAdmin,
    saveAdmin,
    getAllAdmins,
    verifyPassword,
    hashPassword,
    generateToken,
    verifyToken,
    verifyVipKey,
};
