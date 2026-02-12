const express = require('express');
const cors = require('cors');
const path = require('path');
const authMiddleware = require('./middleware/auth.middleware');
const authRoutes = require('./routes/auth.routes');
const projectRoutes = require('./routes/projects.routes');
const noteRoutes = require('./routes/notes.routes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));

// Auth routes (before auth middleware)
app.use('/api/auth', authRoutes);

// Auth middleware — protects all /api/ routes below
app.use(authMiddleware);

// API Routes
app.use('/api/projects', projectRoutes);
app.use('/api/notes', noteRoutes);

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
