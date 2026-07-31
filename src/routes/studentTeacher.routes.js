const router = require('express').Router();
const { createStudentTeacher, updateStudentTeacher } = require('../schemas/studentTeacher.schema');
const { validate } = require('../middleware/validate');
const auth = require('../middleware/auth');
const { isStudent } = require('../middleware/role');
const ctrl = require('../controllers/studentTeacher.controller');

// «Мои преподаватели» — карточки, которые ученик заводит сам. Только ученик, только свои.
router.get('/',       auth, isStudent, ctrl.list);
router.post('/',      auth, isStudent, validate(createStudentTeacher), ctrl.create);
router.put('/:id',    auth, isStudent, validate(updateStudentTeacher), ctrl.update);
router.delete('/:id', auth, isStudent, ctrl.remove);

module.exports = router;
