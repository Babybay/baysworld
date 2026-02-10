const express = require('express');
const {
  startApp,
  stopApp,
  deleteApp,
  renameApp,
} = require('../controllers/apps.controller');

const router = express.Router();

router.post('/:id/start', startApp);
router.post('/:id/stop', stopApp);
router.delete('/:id', deleteApp);
router.post('/:id/rename', renameApp);


module.exports = router;
