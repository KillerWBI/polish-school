const router = require('express').Router();
const { recordPaymentSchema } = require('../schemas/payment.schema');
const { validate } = require('../middleware/validate');
const auth = require('../middleware/auth');
const { isTeacher } = require('../middleware/role');
const ctrl = require('../controllers/payment.controller');

router.get('/debt', auth, ctrl.getDebt);
router.get('/my-history', auth, ctrl.getMyPaymentHistory);
router.get('/debts', auth, isTeacher, ctrl.getDebtsForTeacher);
router.get('/history', auth, isTeacher, ctrl.getPaymentHistory);
router.post('/record', auth, isTeacher, validate(recordPaymentSchema), ctrl.recordPayment);
router.get('/teacher-info/:teacherId', auth, ctrl.getTeacherPaymentInfo);
router.post('/student-pay', auth, ctrl.studentRecordPayment);

module.exports = router;
