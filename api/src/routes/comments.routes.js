const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/comments.controller');

router.get('/pending', ctrl.getPending);
router.get('/:entityType/:entityId', ctrl.getComments);
router.post('/:entityType/:entityId', ctrl.addComment);
router.put('/:id/approve', ctrl.approve);
router.delete('/:id', ctrl.remove);

module.exports = router;
