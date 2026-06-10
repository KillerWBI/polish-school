const router = require('express').Router();
const auth = require('../middleware/auth');
const { isTeacher, isStudent } = require('../middleware/role');
const ctrl = require('../controllers/attendance.controller');

// ВАЖНО: /pending должен быть ДО /:id, иначе Express считает 'pending' параметром id
router.get('/pending', auth, ctrl.getPending);

router.get('/',    auth,            ctrl.getAll);
router.post('/',   auth, isTeacher, ctrl.create);

// Студент подтверждает своё посещение
router.post('/:id/confirm', auth, isStudent, ctrl.confirmStudent);

// Учитель разрешает спор (accept: true/false)
router.put('/:id', auth, isTeacher, ctrl.teacherResolve);

module.exports = router;
