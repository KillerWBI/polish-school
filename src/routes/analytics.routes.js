const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/analytics.controller');

// Аналитика учителя — публичная (для всех авторизованных).
// ?period=day|week|month (default: month)
router.get('/teacher/:userId', auth, ctrl.getTeacherAnalytics);

// Аналитика студента — приватная (сам студент + его учитель).
// Проверка доступа — внутри контроллера через canViewStudentAnalytics.
router.get('/student/:id', auth, ctrl.getStudentAnalytics);

module.exports = router;
