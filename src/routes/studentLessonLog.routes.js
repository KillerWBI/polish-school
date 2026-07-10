const router = require('express').Router();
const { createLog, updateLog } = require('../schemas/studentLessonLog.schema');
const { validate } = require('../middleware/validate');
const auth = require('../middleware/auth');
const { isStudent } = require('../middleware/role');
const ctrl = require('../controllers/studentLessonLog.controller');

// Личный журнал внешних/самостоятельных занятий — только ученик
router.get('/',          auth, isStudent, ctrl.list);
router.get('/stats',     auth, isStudent, ctrl.stats);
router.post('/',         auth, isStudent, validate(createLog), ctrl.create);
router.put('/:id',       auth, isStudent, validate(updateLog), ctrl.update);
router.patch('/:id/pay', auth, isStudent, ctrl.markPaid);
router.delete('/:id',    auth, isStudent, ctrl.remove);

module.exports = router;
