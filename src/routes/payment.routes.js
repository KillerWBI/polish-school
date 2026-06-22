const router = require('express').Router();
const { recordPaymentSchema } = require('../schemas/payment.schema');
const { validate } = require('../middleware/validate');
const auth = require('../middleware/auth');
const { isTeacher } = require('../middleware/role');
const ctrl = require('../controllers/payment.controller');

router.get('/debt', auth, ctrl.getDebt);
router.get('/debts', auth, isTeacher, ctrl.getDebtsForTeacher);
router.post('/record', auth, isTeacher, validate(recordPaymentSchema), ctrl.recordPayment);

module.exports = router;
