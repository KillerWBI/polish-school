const router = require('express').Router();
const auth = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { registerSchema, loginSchema, changePasswordSchema } = require('../schemas/auth.schema');
const ctrl = require('../controllers/auth.controller');

router.post('/register',             validate(registerSchema), ctrl.register);
router.post('/register-teacher',     validate(registerSchema), ctrl.registerTeacher);
router.post('/login',                validate(loginSchema), ctrl.login);
router.get ('/me',                   auth, ctrl.me);
router.put ('/password',             auth, validate(changePasswordSchema), ctrl.changePassword);
router.get ('/verify-email',         ctrl.verifyEmail);          // ?token=...
router.post('/resend-verification',  auth, ctrl.resendVerification);

module.exports = router;
