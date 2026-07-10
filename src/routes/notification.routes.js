const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/notification.controller');

router.get('/',            auth, ctrl.list);
router.patch('/read-all',  auth, ctrl.markAllRead);
router.patch('/:id/read',  auth, ctrl.markRead);

module.exports = router;
