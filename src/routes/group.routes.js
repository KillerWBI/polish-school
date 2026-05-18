const router = require('express').Router();
const auth = require('../middleware/auth');
const { isTeacher } = require('../middleware/role');
const ctrl = require('../controllers/group.controller');

router.get('/', auth, ctrl.getAll);
router.post('/', auth, isTeacher, ctrl.create);
router.get('/:id', auth, ctrl.getOne);
router.put('/:id', auth, isTeacher, ctrl.update);
router.delete('/:id', auth, isTeacher, ctrl.remove);
router.post('/:id/students', auth, isTeacher, ctrl.addStudent);
router.delete('/:id/students/:studentId', auth, isTeacher, ctrl.removeStudent);

module.exports = router;
