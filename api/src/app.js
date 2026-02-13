const express = require('express');
const cors = require('cors');
const path = require('path');
const authMiddleware = require('./middleware/auth.middleware');
const authRoutes = require('./routes/auth.routes');
const projectRoutes = require('./routes/projects.routes');
const noteRoutes = require('./routes/notes.routes');
const logsRoutes = require('./routes/logs.routes');
const seoRoutes = require('./routes/seo.routes');
const mediaRoutes = require('./routes/media.routes');
const statsRoutes = require('./routes/stats.routes');
const commentsRoutes = require('./routes/comments.routes');
const subscriptionsRoutes = require('./routes/subscriptions.routes');

const app = express();

// View engine (EJS for SSR pages)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));

// Serve uploaded media
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// SEO routes — SSR pages (public, before auth middleware)
app.use(seoRoutes);

// Auth routes (before auth middleware)
app.use('/api/auth', authRoutes);

// Auth middleware — protects all /api/ routes below
app.use(authMiddleware);

// API Routes
app.use('/api/projects', projectRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api/subscribe', subscriptionsRoutes);
app.use('/api/unsubscribe', subscriptionsRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/logs', logsRoutes);

// API health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SPA fallback — serve index.html for all non-API routes
app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;
