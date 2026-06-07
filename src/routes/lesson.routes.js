const router = require('express').Router();
const auth = require('../middleware/auth');
const { isTeacher } = require('../middleware/role');
const { validate } = require('../middleware/validate');
const { createLesson, updateLesson } = require('../schemas/lesson.schema');
const ctrl = require('../controllers/lesson.controller');

router.get('/', auth, ctrl.getAll);
router.post('/', auth, isTeacher, validate(createLesson), ctrl.create);
router.get('/:id', auth, ctrl.getOne);
router.put('/:id', auth, isTeacher, validate(updateLesson), ctrl.update);
router.delete('/:id', auth, isTeacher, ctrl.remove);

module.exports = router;
