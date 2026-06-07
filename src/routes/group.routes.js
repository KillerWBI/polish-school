const router = require('express').Router();
const auth = require('../middleware/auth');
const { isTeacher } = require('../middleware/role');
const { validate } = require('../middleware/validate');
const { createGroup, updateGroup, addStudent } = require('../schemas/group.schema');
const ctrl = require('../controllers/group.controller');

router.get('/', auth, ctrl.getAll);
router.post('/', auth, isTeacher, validate(createGroup), ctrl.create);
router.get('/:id', auth, ctrl.getOne);
router.put('/:id', auth, isTeacher, validate(updateGroup), ctrl.update);
router.delete('/:id', auth, isTeacher, ctrl.remove);
router.post('/:id/students', auth, isTeacher, validate(addStudent), ctrl.addStudent);
router.delete('/:id/students/:studentId', auth, isTeacher, ctrl.removeStudent);
router.post('/:id/generate-lessons', auth, isTeacher, ctrl.generateLessons);

module.exports = router;
