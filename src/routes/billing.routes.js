const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/billing.controller');

// Вебхук Paddle смонтирован отдельно в app.js — ему нужно RAW-тело до express.json

router.get ('/status', auth, ctrl.status);  // состояние подписки + дата следующего списания
router.post('/cancel', auth, ctrl.cancel);  // отмена в конце оплаченного периода
router.post('/resume', auth, ctrl.resume);  // передумал — снять запланированную отмену

module.exports = router;
