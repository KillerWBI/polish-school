const router = require('express').Router();
const auth = require('../middleware/auth');
const { isTeacher } = require('../middleware/role');
const { validate } = require('../middleware/validate');
const { mergeStudent } = require('../schemas/student.schema');
const ctrl = require('../controllers/student.controller');

router.post('/:id/merge', auth, isTeacher, validate(mergeStudent), ctrl.merge);
router.delete('/:id', auth, isTeacher, ctrl.remove);

module.exports = router;
