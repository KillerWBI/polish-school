const router = require('express').Router();
const auth = require('../middleware/auth');
const { isTeacher } = require('../middleware/role');
const { validate } = require('../middleware/validate');
const { previewInvoice, createInvoice, patchInvoice } = require('../schemas/invoice.schema');
const ctrl = require('../controllers/invoice.controller');

// Список и сам документ доступны обеим сторонам счёта — проверка внутри контроллера.
router.get('/', auth, ctrl.getAll);
// Расчёт до выпуска — только преподавателю: ученику предварительный счёт не нужен.
router.get('/preview', auth, isTeacher, validate(previewInvoice, 'query'), ctrl.preview);
router.get('/:id', auth, ctrl.getOne);

router.post('/', auth, isTeacher, validate(createInvoice), ctrl.create);
router.patch('/:id', auth, isTeacher, validate(patchInvoice), ctrl.patch);
router.delete('/:id', auth, isTeacher, ctrl.remove);

module.exports = router;
