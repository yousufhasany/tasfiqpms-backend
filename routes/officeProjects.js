const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const ctrl = require('../controllers/officeProjectController');

// Both admin and office can view and manage projects
router.get('/', auth, ctrl.getAll);
router.get('/:id', auth, ctrl.getOne);
router.post('/', auth, requireRole('admin', 'office'), ctrl.create);
router.put('/:id', auth, requireRole('admin', 'office'), ctrl.update);

// Both admin and office can delete (cascades to all transactions in the project)
router.delete('/:id', auth, requireRole('admin', 'office'), ctrl.remove);

module.exports = router;
