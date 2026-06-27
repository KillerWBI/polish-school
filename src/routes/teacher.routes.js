const router = require('express').Router();
const { catalogQuery } = require('../schemas/teacher.schema');
const { validate } = require('../middleware/validate');
const auth = require('../middleware/auth');
const ctrl = require('../controllers/teacher.controller');

router.get('/catalog', auth, validate(catalogQuery, 'query'), ctrl.getCatalog);

module.exports = router;
