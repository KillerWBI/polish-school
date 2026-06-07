const router = require('express').Router();
const { calculatePaymentSchema, updatePaymentSchema, paginationQuery } = require('../schemas/payment.schema');
const { validate } = require('../middleware/validate');
const auth = require('../middleware/auth');
const { isTeacher } = require('../middleware/role');
const ctrl = require('../controllers/payment.controller');

router.get('/', auth, validate(paginationQuery, 'query'), ctrl.getAll);
router.post('/calculate', auth, isTeacher, validate(calculatePaymentSchema), ctrl.calculate);
router.put('/:id', auth, isTeacher, validate(updatePaymentSchema), ctrl.update);

module.exports = router;
