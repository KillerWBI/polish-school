const router = require('express').Router();
const auth = require('../middleware/auth');
const { isTeacher } = require('../middleware/role');
const { validate } = require('../middleware/validate');
const { searchUser } = require('../schemas/invitation.schema');
const ctrl = require('../controllers/user.controller');
const followCtrl = require('../controllers/follow.controller');

// Специфичные роуты — ДО /:id чтобы Express не съел их как ID
router.put('/me/profile',          auth, ctrl.updateProfile);
router.get('/me/students',         auth, isTeacher, ctrl.getMyStudents); // «мои ученики» (TeacherStudent)
router.get('/search',              auth, isTeacher, validate(searchUser, 'query'), ctrl.searchByUsername); // С3: поиск по username для приглашения
router.get('/@:username/profile',  auth, ctrl.getPublicProfile);

router.get('/', auth, isTeacher, ctrl.getAll);
router.get('/:id', auth, ctrl.getOne);
router.put('/:id', auth, ctrl.update);

// Подписки (follow ≠ заявка): /users/:id/follow
router.post('/:id/follow',   auth, followCtrl.follow);
router.delete('/:id/follow', auth, followCtrl.unfollow);

module.exports = router;
