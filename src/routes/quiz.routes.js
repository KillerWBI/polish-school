const router = require('express').Router();
const { createQuizSchema } = require('../schemas/quiz.schema');
const { validate } = require('../middleware/validate');
const auth = require('../middleware/auth');
const ctrl = require('../controllers/quiz.controller');

// Тесты доступны обеим ролям; владелец = текущий пользователь (контроллер фильтрует по req.user.id).
router.get('/', auth, ctrl.list);
router.get('/:id', auth, ctrl.getOne);
router.post('/', auth, validate(createQuizSchema), ctrl.create);
router.delete('/:id', auth, ctrl.remove);

module.exports = router;
