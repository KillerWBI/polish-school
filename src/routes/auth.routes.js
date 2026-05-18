const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/auth.controller');

router.post('/register', ctrl.register);
router.post('/register-teacher', ctrl.registerTeacher);
router.post('/login', ctrl.login);
router.get('/me', auth, ctrl.me);
router.put('/password', auth, ctrl.changePassword);

module.exports = router;
