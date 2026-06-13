const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const settingsController = require('../controllers/settingsController');

// GET /api/settings — accessible to all authenticated users (navbar needs it)
router.get('/', auth, settingsController.getSettings);

// PUT /api/settings — admin only
router.put('/', auth, requireRole('admin'), settingsController.updateSettings);

module.exports = router;
