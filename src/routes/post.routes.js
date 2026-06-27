const router = require('express').Router();
const auth = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createPost } = require('../schemas/post.schema');
const ctrl = require('../controllers/post.controller');

router.get('/', auth, ctrl.getByAuthor);                       // ?authorId= — посты автора (профиль)
router.post('/', auth, validate(createPost), ctrl.create);     // создать пост (любая роль)
router.delete('/:id', auth, ctrl.remove);                      // удалить свой пост
router.post('/:id/like', auth, ctrl.like);                     // лайкнуть
router.delete('/:id/like', auth, ctrl.unlike);                 // снять лайк

module.exports = router;
