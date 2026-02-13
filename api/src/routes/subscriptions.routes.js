const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/subscriptions.controller');

router.post('/', ctrl.subscribe);
router.delete('/:email', ctrl.unsubscribe);
router.get('/', ctrl.list);

module.exports = router;
