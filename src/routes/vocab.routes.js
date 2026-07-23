const router = require('express').Router();
const { createVocab, updateVocab, reviewVocab, bulkVocab, generateVocabReq } = require('../schemas/vocab.schema');
const { validate } = require('../middleware/validate');
const auth = require('../middleware/auth');
const { isStudent } = require('../middleware/role');
const ctrl = require('../controllers/vocab.controller');

// Личный словарь — только для ученика (у учителя своя рабочая область)
router.get('/',            auth, isStudent, ctrl.list);
router.get('/due',         auth, isStudent, ctrl.due);
router.post('/',           auth, isStudent, validate(createVocab), ctrl.create);
router.post('/bulk',       auth, isStudent, validate(bulkVocab), ctrl.bulkCreate);        // массовая вставка
router.post('/generate',   auth, isStudent, validate(generateVocabReq), ctrl.generate);   // AI-генерация набора
router.put('/:id',         auth, isStudent, validate(updateVocab), ctrl.update);
router.patch('/:id/review', auth, isStudent, validate(reviewVocab), ctrl.review);
router.delete('/:id',      auth, isStudent, ctrl.remove);

module.exports = router;
