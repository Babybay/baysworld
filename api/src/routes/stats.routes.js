const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/stats.controller');

router.post('/view', ctrl.recordView);
router.get('/public', ctrl.getPublicStats);
router.get('/', ctrl.getDashboard);

module.exports = router;
