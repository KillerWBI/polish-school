const router = require('express').Router();
const auth = require('../middleware/auth');
const { isTeacher } = require('../middleware/role');
const { validate } = require('../middleware/validate');
const { createIndividualLesson, updateIndividualLesson } = require('../schemas/individualLesson.schema');
const ctrl = require('../controllers/individualLesson.controller');

router.get('/', auth, ctrl.getAll);
router.post('/', auth, isTeacher, validate(createIndividualLesson), ctrl.create);
router.get('/:id', auth, ctrl.getOne);
router.put('/:id', auth, isTeacher, validate(updateIndividualLesson), ctrl.update);
router.delete('/:id', auth, isTeacher, ctrl.remove);

module.exports = router;
