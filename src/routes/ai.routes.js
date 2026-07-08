const router = require('express').Router();
const { quizSchema } = require('../schemas/ai.schema');
const { validate } = require('../middleware/validate');
const auth = require('../middleware/auth');
const ctrl = require('../controllers/ai.controller');

// Генерация теста доступна обеим ролям (учитель — в библиотеку, ученик — для себя).
router.post('/quiz', auth, validate(quizSchema), ctrl.quiz);

module.exports = router;
