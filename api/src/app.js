const express = require('express');
const deployRoutes = require('./routes/deploy.routes');
const appsRoutes = require('./routes/apps.routes');
const uiRoutes = require('./routes/ui.routes');
const rateLimit = require('express-rate-limit');
const methodOverride = require('method-override');

const app = express();

// ---------------- MIDDLEWARE DASAR ----------------
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));

app.use(express.static('public'));

const deployLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { error: 'Deploy rate limit exceeded' },
});

// ---------------- ROUTES ----------------
app.use('/api/deploy', deployLimiter);
app.use('/api', deployRoutes);
app.use('/apps', appsRoutes);
app.use('/', uiRoutes);

// ---------------- METHOD OVERRIDE ----------------
app.use(methodOverride('_method'));

module.exports = app;
