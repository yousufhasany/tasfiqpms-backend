const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/officeProjectController');

// View routes — accessible to all authenticated roles, filtered in controller
router.get('/', auth, ctrl.getAll);
router.get('/:id', auth, ctrl.getOne);

// Admin-only CRUD actions
router.post('/', auth, requireRole('admin'), ctrl.create);
router.put('/:id', auth, requireRole('admin'), ctrl.update);
router.delete('/:id', auth, requireRole('admin'), ctrl.remove);

// Progress updates — accessible to Admin and Manager
router.post('/:id/updates', auth, requireRole('admin', 'manager'), ctrl.addUpdate);

module.exports = router;
