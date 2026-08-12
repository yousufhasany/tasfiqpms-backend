const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const userController = require('../controllers/userController');

// All endpoints in this file are restricted to admin
router.use(auth, requireRole('admin'));

router.get('/managers', userController.getManagers);
router.post('/managers', userController.createManager);
router.put('/managers/:id', userController.updateManager);
router.delete('/managers/:id', userController.deleteManager);

// General User management
router.get('/', userController.getUsers);
router.put('/:id/password', userController.updateUserPassword);
router.put('/:id/status', userController.updateUserStatus);
router.put('/:id/role', userController.updateUserRole);
router.delete('/:id', userController.deleteUser);

module.exports = router;
