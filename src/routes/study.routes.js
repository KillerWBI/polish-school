const router = require('express').Router();
const { z } = require('zod');
const { validate } = require('../middleware/validate');
const auth = require('../middleware/auth');
const { isStudent } = require('../middleware/role');
const ctrl = require('../controllers/study.controller');

// Ежедневная сессия повторения — собирает due-карточки со всех треков + словаря
const reviewItem = z.object({
  kind:    z.enum(['card', 'vocab']),
  id:      z.string().min(1),
  correct: z.boolean(),
});

router.get('/session',    auth, isStudent, ctrl.session);
router.get('/weak-spots', auth, isStudent, ctrl.weakSpots);
router.post('/review',    auth, isStudent, validate(reviewItem), ctrl.review);

module.exports = router;
