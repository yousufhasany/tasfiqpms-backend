const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/transactionRequestController');

// Submit transaction request: Managers and Admins can create
router.post('/', auth, requireRole('manager', 'admin'), ctrl.createRequest);

// List transaction requests: Any authenticated user (Admins see all; managers see their own, filtered in controller)
router.get('/', auth, ctrl.getRequests);

// Admin approvals and rejections
router.put('/:id/approve', auth, requireRole('admin'), ctrl.approveRequest);
router.put('/:id/reject', auth, requireRole('admin'), ctrl.rejectRequest);

// Admin edit and delete
router.put('/:id', auth, requireRole('admin'), ctrl.updateRequest);
router.delete('/:id', auth, requireRole('admin'), ctrl.deleteRequest);

module.exports = router;
