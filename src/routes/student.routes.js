const router = require('express').Router();
const auth = require('../middleware/auth');
const { isTeacher, isStudent } = require('../middleware/role');
const { validate } = require('../middleware/validate');
const { mergeStudent, targetedQuiz } = require('../schemas/student.schema');
const ctrl = require('../controllers/student.controller');

// Прогресс-центр ученика (streak, активность, словарь, внешние занятия)
router.get('/me/progress', auth, isStudent, ctrl.getMyProgress);

router.post('/:id/merge', auth, isTeacher, validate(mergeStudent), ctrl.merge);
router.delete('/:id', auth, isTeacher, ctrl.remove);

// Фаза 3: учитель видит слабые места ученика (из расшаренных треков) → адресный тест
router.get('/:id/track-insights', auth, isTeacher, ctrl.getTrackInsights);
router.post('/:id/targeted-quiz', auth, isTeacher, validate(targetedQuiz), ctrl.generateTargetedQuiz);

module.exports = router;
