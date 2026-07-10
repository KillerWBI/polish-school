const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/materials.controller');

// Материалы уроков — обе роли (role-switch внутри контроллера)
router.get('/', auth, ctrl.list);

module.exports = router;
