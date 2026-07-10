const router = require('express').Router();
const auth = require('../middleware/auth');
const { isTeacher } = require('../middleware/role');
const { validate } = require('../middleware/validate');
const { searchUser } = require('../schemas/invitation.schema');
const { updateUser, updateProfile } = require('../schemas/user.schema');
const ctrl = require('../controllers/user.controller');

// Специфичные роуты — ДО /:id чтобы Express не съел их как ID
router.put('/me/profile',          auth, validate(updateProfile), ctrl.updateProfile);
router.get('/me/students',         auth, isTeacher, ctrl.getMyStudents); // «мои ученики»
router.get('/search',              auth, isTeacher, validate(searchUser, 'query'), ctrl.searchByUsername); // С3: поиск учеников по нику/имени для приглашения

router.get('/', auth, isTeacher, ctrl.getAll);
router.get('/:id', auth, ctrl.getOne);
router.put('/:id', auth, validate(updateUser), ctrl.update);

// ⏸️ Запарковано (соц-слой): публичный профиль /@:username и follow — размонтированы.
// getPublicProfile / follow.controller оставлены в коде для будущего соц-сервиса.

module.exports = router;
