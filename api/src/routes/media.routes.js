const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/media.controller');

// Upload images to project
router.post('/upload/:projectId', ctrl.uploadMiddleware, ctrl.handleMulterError, ctrl.upload);

// Upload/replace project thumbnail
router.post('/thumbnail/:projectId', ctrl.thumbnailMiddleware, ctrl.handleMulterError, ctrl.uploadThumbnail);

// List media for a project
router.get('/:projectId', ctrl.listMedia);

// Delete specific media file
router.delete('/:projectId/:filename', ctrl.deleteMedia);

module.exports = router;
