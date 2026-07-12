const router = require('express').Router();
const { createTopic, submitAttempt } = require('../schemas/topic.schema');
const { validate } = require('../middleware/validate');
const auth = require('../middleware/auth');
const { isStudent } = require('../middleware/role');
const ctrl = require('../controllers/topic.controller');

// Самостоятельные темы ученика с адаптивными AI-тестами — только ученик
router.get('/',             auth, isStudent, ctrl.list);
router.post('/',            auth, isStudent, validate(createTopic), ctrl.create);
router.delete('/:id',       auth, isStudent, ctrl.remove);
router.post('/:id/next',    auth, isStudent, ctrl.next);
router.post('/:id/attempt', auth, isStudent, validate(submitAttempt), ctrl.attempt);

module.exports = router;
