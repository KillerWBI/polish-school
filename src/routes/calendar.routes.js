const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/calendar.controller');

// Ссылку на подписку показываем только владельцу
router.get ('/subscription',       auth, ctrl.getSubscription);
router.post('/subscription/reset', auth, ctrl.resetSubscription); // ссылка утекла — выпустить новую

// Сам календарь — БЕЗ auth: за ним ходит сервер Google/Apple, куки он не пришлёт.
// Доступ даёт знание 48-символьного токена. Регистрируем последним, чтобы
// ':token.ics' не перехватил статические пути выше.
router.get('/:token.ics', ctrl.getIcs);

module.exports = router;
