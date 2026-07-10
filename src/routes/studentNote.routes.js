const router = require('express').Router();
const { createNote, updateNote } = require('../schemas/studentNote.schema');
const { validate } = require('../middleware/validate');
const auth = require('../middleware/auth');
const { isStudent } = require('../middleware/role');
const ctrl = require('../controllers/studentNote.controller');

// Личные заметки — только ученик
router.get('/',       auth, isStudent, ctrl.list);
router.post('/',      auth, isStudent, validate(createNote), ctrl.create);
router.put('/:id',    auth, isStudent, validate(updateNote), ctrl.update);
router.delete('/:id', auth, isStudent, ctrl.remove);

module.exports = router;
