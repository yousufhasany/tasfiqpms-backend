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

module.exports = router;
