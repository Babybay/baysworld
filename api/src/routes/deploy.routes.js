const express = require('express');
const multer = require('multer');
const path = require('path');
const { deployApp } = require('../controllers/deploy.controller');

const router = express.Router();

const upload = multer({
  dest: path.join(__dirname, '../../uploads')
});


router.post('/deploy', upload.single('file'), deployApp);

module.exports = router;
