const { getAdmin, saveAdmin, verifyPassword, hashPassword, generateToken, verifyToken } = require('../services/auth.service');

// POST /api/auth/login
exports.login = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }

    try {
        const admin = await getAdmin();
        if (!admin || username !== admin.username) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        if (!verifyPassword(password, admin.password_hash)) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        const token = generateToken(admin.username);
        res.json({ token, username: admin.username, message: 'Login successful!' });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed' });
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
        const admin = await getAdmin();
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
