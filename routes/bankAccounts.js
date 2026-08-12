const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/bankAccountController');

router.get('/', auth, requireRole('admin', 'office', 'finance_manager', 'manager'), ctrl.getAll);
router.post('/', auth, requireRole('admin', 'manager', 'finance_manager'), ctrl.create);
router.put('/:id', auth, requireRole('admin'), ctrl.update);
router.delete('/:id', auth, requireRole('admin'), ctrl.remove);

module.exports = router;
