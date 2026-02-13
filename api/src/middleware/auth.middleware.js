const { verifyToken } = require('../services/auth.service');

/**
 * Auth middleware — protects write operations (POST, PUT, DELETE).
 * GET requests on /api/projects and /api/notes are PUBLIC.
 * All other /api/ routes require valid JWT.
 */
function authMiddleware(req, res, next) {
    // Skip auth for auth endpoints and health check
    if (req.path === '/api/auth/login' || req.path === '/api/auth/register' || req.path === '/api/auth/verify' || req.path === '/api/health') {
        return next();
    }

    // Skip auth for non-API routes (static files, SPA fallback)
    if (!req.path.startsWith('/api/')) {
        return next();
    }

    // PUBLIC: Allow GET on projects and notes (read-only access)
    if (req.method === 'GET' && (
        req.path.startsWith('/api/projects') ||
        req.path.startsWith('/api/notes') ||
        req.path.startsWith('/api/stats/public') ||
        req.path.startsWith('/api/comments/')
    )) {
        // Still attach user if token present (for frontend to know auth status)
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const decoded = verifyToken(authHeader.split(' ')[1]);
            if (decoded) req.user = decoded;
        }
        return next();
    }

    // PUBLIC: Allow POST on stats/view, comments, subscribe, and DELETE on unsubscribe
    if (
        (req.method === 'POST' && req.path === '/api/stats/view') ||
        (req.method === 'POST' && req.path.match(/^\/api\/comments\/\w+\/[\w-]+$/)) ||
        (req.method === 'POST' && req.path === '/api/subscribe') ||
        (req.method === 'DELETE' && req.path.startsWith('/api/unsubscribe/'))
    ) {
        return next();
    }

    // PROTECTED: All other API requests require auth
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Access denied. Login required.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded) {
        return res.status(401).json({ error: 'Invalid or expired token.' });
    }

    req.user = decoded;
    next();
}

module.exports = authMiddleware;
