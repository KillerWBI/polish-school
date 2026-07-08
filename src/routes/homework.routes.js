const router = require('express').Router();
const auth = require('../middleware/auth');
const { isTeacher, isStudent } = require('../middleware/role');
const { validate } = require('../middleware/validate');
const { createHomework, updateHomework, submitHomework, gradeSubmission, quizAttempt } = require('../schemas/homework.schema');
const ctrl = require('../controllers/homework.controller');

router.get('/', auth, ctrl.getAll);
router.post('/', auth, isTeacher, validate(createHomework), ctrl.create);
router.get('/:id', auth, ctrl.getOne);
router.put('/:id', auth, isTeacher, validate(updateHomework), ctrl.update);
router.delete('/:id', auth, isTeacher, ctrl.remove);
router.post('/:id/submit', auth, isStudent, validate(submitHomework), ctrl.submit);
router.get('/:id/submissions', auth, isTeacher, ctrl.getSubmissions);
router.put('/:id/submissions/:subId', auth, isTeacher, validate(gradeSubmission), ctrl.gradeSubmission);
// Прикреплённый тест: прохождение (обе роли с доступом) + просмотр прохождений (учитель)
router.post('/:id/quiz-attempt', auth, validate(quizAttempt), ctrl.submitQuizAttempt);
router.get('/:id/quiz-attempts', auth, isTeacher, ctrl.getQuizAttempts);

module.exports = router;
