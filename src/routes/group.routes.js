const router = require('express').Router();
const auth = require('../middleware/auth');
const { isTeacher } = require('../middleware/role');
const { validate } = require('../middleware/validate');
const { createGroup, updateGroup, addStudent, addPlaceholder } = require('../schemas/group.schema');
const { createInvitation } = require('../schemas/invitation.schema');
const ctrl = require('../controllers/group.controller');
const invitationCtrl = require('../controllers/invitation.controller');

router.get('/', auth, ctrl.getAll);
router.post('/', auth, isTeacher, validate(createGroup), ctrl.create);
router.get('/:id', auth, ctrl.getOne);
router.put('/:id', auth, isTeacher, validate(updateGroup), ctrl.update);
router.delete('/:id', auth, isTeacher, ctrl.remove);
router.post('/:id/students', auth, isTeacher, validate(addStudent), ctrl.addStudent);
router.post('/:id/placeholder', auth, isTeacher, validate(addPlaceholder), ctrl.addPlaceholder);
router.delete('/:id/students/:studentId', auth, isTeacher, ctrl.removeStudent);
router.post('/:id/generate-lessons', auth, isTeacher, ctrl.generateLessons);
// С3: пригласить студента (по User.id) в группу — отправитель учитель, получатель студент.
router.post('/:id/invitations', auth, isTeacher, validate(createInvitation), invitationCtrl.create);

module.exports = router;
