const router = require('express').Router();
const auth = require('../middleware/auth');
const { isTeacher } = require('../middleware/role');
const ctrl = require('../controllers/payment.controller');

router.get('/', auth, ctrl.getAll);
router.post('/calculate', auth, isTeacher, ctrl.calculate);
router.put('/:id', auth, isTeacher, ctrl.update);

module.exports = router;
