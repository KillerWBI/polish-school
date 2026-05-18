const router = require('express').Router();
const auth = require('../middleware/auth');
const { isTeacher } = require('../middleware/role');
const ctrl = require('../controllers/user.controller');

router.get('/', auth, isTeacher, ctrl.getAll);
router.get('/:id', auth, ctrl.getOne);
router.put('/:id', auth, ctrl.update);

module.exports = router;
