const {
    getAdmin, getAdminByUsername, createAdmin, saveAdmin, getAllAdmins,
    verifyPassword, hashPassword, generateToken, verifyToken, verifyVipKey,
} = require('../services/auth.service');
const LogService = require('../services/log.service');

// POST /api/auth/login
exports.login = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }

    try {
        const admin = await getAdminByUsername(username);
        if (!admin) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        if (!verifyPassword(password, admin.password_hash)) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        const token = generateToken(admin.username);

        await LogService.log('login', 'admin', String(admin.id), admin.username,
            admin.username, 'Admin logged in', req.ip);

        res.json({ token, username: admin.username, message: 'Login successful!' });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed' });
    }
};

// POST /api/auth/register
exports.register = async (req, res) => {
    const { username, password, vipKey } = req.body;

    if (!username || !password || !vipKey) {
        return res.status(400).json({ error: 'Username, password, and VIP key are required.' });
    }

    if (!verifyVipKey(vipKey)) {
        return res.status(403).json({ error: 'Invalid VIP key. Access denied.' });
    }

    if (username.length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters.' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    // Only allow alphanumeric + underscore usernames
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores.' });
    }

    try {
        const existing = await getAdminByUsername(username);
        if (existing) {
            return res.status(409).json({ error: 'Username already taken.' });
        }

        const admin = await createAdmin(username, password);
        const token = generateToken(admin.username);

        await LogService.log('register', 'admin', String(admin.id), admin.username,
            admin.username, 'New admin registered', req.ip);

        res.status(201).json({ token, username: admin.username, message: 'Admin account created!' });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Registration failed' });
    }
};

// GET /api/auth/verify
exports.verify = (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.json({ valid: false });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded) {
        return res.json({ valid: false });
    }

    res.json({ valid: true, username: decoded.username });
};

// PUT /api/auth/change-password
exports.changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current and new passwords are required.' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    try {
        // Use the logged-in user's username from JWT
        const username = req.user?.username;
        if (!username) {
            return res.status(401).json({ error: 'Not authenticated.' });
        }

        const admin = await getAdminByUsername(username);
        if (!admin) {
            return res.status(500).json({ error: 'Admin not found' });
        }

        if (!verifyPassword(currentPassword, admin.password_hash)) {
            return res.status(401).json({ error: 'Current password is incorrect.' });
        }

        await saveAdmin({ username: admin.username, passwordHash: hashPassword(newPassword) });
        res.json({ message: 'Password changed successfully!' });
    } catch (err) {
        console.error('Change password error:', err);
        res.status(500).json({ error: 'Failed to change password' });
    }
};
