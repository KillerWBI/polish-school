const router = require('express').Router();
const { createTicket } = require('../schemas/support.schema');
const { validate } = require('../middleware/validate');
const optionalAuth = require('../middleware/optionalAuth');
const ctrl = require('../controllers/support.controller');

// Публичная форма обращения. optionalAuth — если пользователь залогинен, привяжем userId,
// но auth не обязателен (гость с лендинга тоже может написать).
router.post('/ticket', optionalAuth, validate(createTicket), ctrl.createTicket);

module.exports = router;
