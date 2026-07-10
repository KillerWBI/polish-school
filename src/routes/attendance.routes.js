const router = require('express').Router();
const auth = require('../middleware/auth');
const { isTeacher, isStudent } = require('../middleware/role');
const { validate } = require('../middleware/validate');
const { createAttendance, confirmAttendance, resolveAttendance } = require('../schemas/attendance.schema');
const ctrl = require('../controllers/attendance.controller');

// ВАЖНО: /pending должен быть ДО /:id, иначе Express считает 'pending' параметром id
router.get('/pending', auth, ctrl.getPending);

router.get('/',    auth,                                           ctrl.getAll);
router.post('/',   auth, isTeacher, validate(createAttendance),   ctrl.create);

// Студент подтверждает своё посещение
router.post('/:id/confirm', auth, isStudent, validate(confirmAttendance), ctrl.confirmStudent);

// Учитель разрешает спор (accept: true/false)
router.put('/:id', auth, isTeacher, validate(resolveAttendance), ctrl.teacherResolve);

module.exports = router;
