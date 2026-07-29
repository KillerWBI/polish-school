const router = require('express').Router();
const auth = require('../middleware/auth');
const { isStudent, isTeacher } = require('../middleware/role');
const { validate } = require('../middleware/validate');
const { patchInvitation } = require('../schemas/invitation.schema');
const ctrl = require('../controllers/invitation.controller');

router.get('/',       auth, ctrl.getAll);                                      // роль-свитч внутри
router.patch('/:id',  auth, isStudent, validate(patchInvitation), ctrl.patch); // accept/decline
router.delete('/:id', auth, isTeacher, ctrl.remove);                           // учитель отменяет своё приглашение

module.exports = router;
