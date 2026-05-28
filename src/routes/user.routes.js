const router = require('express').Router();
const auth = require('../middleware/auth');
const { isTeacher } = require('../middleware/role');
const ctrl = require('../controllers/user.controller');

// Профиль (специфичные роуты — ДО /:id чтобы Express не съел их как ID)
router.put('/me/profile',          auth, ctrl.updateProfile);
router.get('/@:username/profile',  auth, ctrl.getPublicProfile);

router.get('/', auth, isTeacher, ctrl.getAll);
router.get('/:id', auth, ctrl.getOne);
router.put('/:id', auth, ctrl.update);

module.exports = router;
