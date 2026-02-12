const { Router } = require('express');
const auth = require('../controllers/auth.controller');
const r = Router();

r.post('/login', auth.login);
r.get('/verify', auth.verify);
r.put('/change-password', auth.changePassword);

module.exports = r;
