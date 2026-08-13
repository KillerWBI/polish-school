const router = require('express').Router();
const auth = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { subscribePush, unsubscribePush } = require('../schemas/push.schema');
const ctrl = require('../controllers/push.controller');

// Push доступен обеим ролям — уведомления получают и преподаватель, и ученик.
router.get('/key',           auth, ctrl.getKey);
router.get('/status',        auth, ctrl.status);
router.post('/subscribe',    auth, validate(subscribePush),   ctrl.subscribe);
router.delete('/subscribe',  auth, validate(unsubscribePush), ctrl.unsubscribe);

module.exports = router;
