const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/post.controller');

router.get('/', auth, ctrl.getFeed);   // лента: ?cursor=&limit=

module.exports = router;
