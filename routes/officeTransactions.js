const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/officeTransactionController');

// All authenticated office roles can read and write transactions
router.get('/summary', ctrl.getSummary);
router.get('/', ctrl.getAll);
router.post('/', auth, ctrl.create);
router.put('/:id', auth, ctrl.update);

// Only admins can delete
router.delete('/:id', auth, requireRole('admin'), ctrl.remove);

module.exports = router;
