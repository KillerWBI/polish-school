const router = require('express').Router();
const auth = require('../middleware/auth');
const { isTeacher } = require('../middleware/role');
const ctrl = require('../controllers/attendance.controller');

router.get('/', auth, ctrl.getAll);
router.post('/', auth, isTeacher, ctrl.create);
router.put('/:id', auth, isTeacher, ctrl.update);

module.exports = router;
