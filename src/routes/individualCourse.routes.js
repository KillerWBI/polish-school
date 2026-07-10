const router = require('express').Router();
const auth = require('../middleware/auth');
const { isTeacher } = require('../middleware/role');
const { validate } = require('../middleware/validate');
const { createIndividualCourse, updateIndividualCourse, generateLessonsSchema } = require('../schemas/individualCourse.schema');
const ctrl = require('../controllers/individualCourse.controller');

router.get('/', auth, ctrl.getAll);
router.post('/', auth, isTeacher, validate(createIndividualCourse), ctrl.create);
router.get('/:id', auth, ctrl.getOne);
router.put('/:id', auth, isTeacher, validate(updateIndividualCourse), ctrl.update);
router.delete('/:id', auth, isTeacher, ctrl.remove);
router.post('/:id/generate-lessons', auth, isTeacher, validate(generateLessonsSchema), ctrl.generateLessons);

module.exports = router;
