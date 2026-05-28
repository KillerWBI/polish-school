const router = require('express').Router();
const auth   = require('../middleware/auth');
const ctrl   = require('../controllers/dashboard.controller');

// Доступно обеим ролям — контроллер сам разруливает по req.user.role
router.get('/',         auth, ctrl.getDashboard);
router.get('/activity', auth, ctrl.getActivity);

module.exports = router;
