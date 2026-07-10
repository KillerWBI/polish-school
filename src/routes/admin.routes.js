const router = require('express').Router();
const auth = require('../middleware/auth');
const { isAdmin } = require('../middleware/role');
const { validate } = require('../middleware/validate');
const { updateTicket } = require('../schemas/support.schema');
const ctrl = require('../controllers/admin.controller');
const support = require('../controllers/support.controller');

// Все маршруты — только для администраторов
router.get('/stats',                    auth, isAdmin, ctrl.getStats);
router.get('/teachers',                 auth, isAdmin, ctrl.getTeachers);
router.get('/users',                    auth, isAdmin, ctrl.getUsers);
router.patch('/users/:id/deactivate',   auth, isAdmin, ctrl.deactivateUser);
router.patch('/users/:id/activate',     auth, isAdmin, ctrl.activateUser);
router.patch('/users/:id/plan',         auth, isAdmin, ctrl.setUserPlan);
router.patch('/users/:id/role',         auth, isAdmin, ctrl.setUserRole);

// Поддержка — просмотр и ответ на обращения
router.get('/support',                  auth, isAdmin, support.listTickets);
router.patch('/support/:id',            auth, isAdmin, validate(updateTicket), support.updateTicket);

module.exports = router;
