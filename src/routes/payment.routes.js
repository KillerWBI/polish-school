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
router.get('/pending', auth, isTeacher, ctrl.getPendingPayments);
router.post('/record', auth, isTeacher, validate(recordPaymentSchema), ctrl.recordPayment);
router.patch('/:id/approve', auth, isTeacher, ctrl.approvePayment);
router.patch('/:id/reject', auth, isTeacher, ctrl.rejectPayment);
router.get('/teacher-info/:teacherId', auth, ctrl.getTeacherPaymentInfo);
router.post('/student-pay', auth, ctrl.studentRecordPayment);
router.delete('/:id', auth, ctrl.cancelMyPayment); // ученик отменяет свою pending-заявку

module.exports = router;
