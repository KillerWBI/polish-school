const router = require('express').Router();
const auth = require('../middleware/auth');
const { isTeacher } = require('../middleware/role');
const ctrl = require('../controllers/homework.controller');

router.get('/', auth, ctrl.getAll);
router.post('/', auth, isTeacher, ctrl.create);
router.get('/:id', auth, ctrl.getOne);
router.put('/:id', auth, isTeacher, ctrl.update);
router.delete('/:id', auth, isTeacher, ctrl.remove);
router.post('/:id/submit', auth, ctrl.submit);
router.get('/:id/submissions', auth, isTeacher, ctrl.getSubmissions);
router.put('/:id/submissions/:subId', auth, isTeacher, ctrl.gradeSubmission);

module.exports = router;
