const router = require('express').Router();
const auth = require('../middleware/auth');
const { isStudent, isTeacher } = require('../middleware/role');
const { validate } = require('../middleware/validate');
const { createLessonRequest, patchLessonRequest } = require('../schemas/lessonRequest.schema');
const ctrl = require('../controllers/lessonRequest.controller');

router.get('/',      auth, ctrl.getAll);                                         // роль-свитч внутри
router.post('/',     auth, isStudent, validate(createLessonRequest), ctrl.create);
router.patch('/:id', auth, isTeacher, validate(patchLessonRequest), ctrl.patch); // accept/decline

module.exports = router;
