const router = require('express').Router();
const { createTopic, submitAttempt, generateCards, reviewCard, gradeOpen, sourcesReq, cardsFromText, shareTopic } = require('../schemas/topic.schema');
const { validate } = require('../middleware/validate');
const auth = require('../middleware/auth');
const { isStudent } = require('../middleware/role');
const ctrl = require('../controllers/topic.controller');
const cards = require('../controllers/trackCard.controller');

// Самостоятельные темы ученика с адаптивными AI-тестами — только ученик
router.get('/',             auth, isStudent, ctrl.list);
router.get('/:id',          auth, isStudent, ctrl.getOne);
router.post('/',            auth, isStudent, validate(createTopic), ctrl.create);
router.delete('/:id',       auth, isStudent, ctrl.remove);
router.patch('/:id/share',  auth, isStudent, validate(shareTopic), ctrl.share);
router.post('/:id/next',    auth, isStudent, ctrl.next);
router.post('/:id/attempt', auth, isStudent, validate(submitAttempt), ctrl.attempt);
router.post('/:id/grade-open', auth, isStudent, validate(gradeOpen), ctrl.gradeOpen);
router.get('/:id/sources',            auth, isStudent, ctrl.sourcesList);
router.post('/:id/sources',           auth, isStudent, validate(sourcesReq), ctrl.sources);
router.delete('/:id/sources/:sourceId', auth, isStudent, ctrl.removeSource);

// Флеш-карточки шага + интервальное повторение (SR)
router.post('/:id/cards/generate',        auth, isStudent, validate(generateCards), cards.generate);
router.post('/:id/cards/from-text',       auth, isStudent, validate(cardsFromText), cards.fromText);
router.get('/:id/cards/due',              auth, isStudent, cards.due);
router.get('/:id/cards',                  auth, isStudent, cards.list);
router.patch('/:id/cards/:cardId/review', auth, isStudent, validate(reviewCard), cards.review);
router.delete('/:id/cards/:cardId',       auth, isStudent, cards.remove);

module.exports = router;
