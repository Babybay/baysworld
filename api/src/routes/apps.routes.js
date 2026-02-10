const express = require('express');
const {
  startApp,
  stopApp,
  deleteApp,
  renameApp,
} = require('../controllers/apps.controller');

const router = express.Router();

router.post('/apps/:id/start', startApp);
router.post('/apps/:id/stop', stopApp);
router.delete('/apps/:id', deleteApp);
router.post('/apps/:id/rename', renameApp);


module.exports = router;
