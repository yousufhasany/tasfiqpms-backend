const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const auth = require('../middleware/auth');

router.get('/stats', auth, dashboardController.getStats);
router.get('/office-summary', auth, dashboardController.getOfficeSummary);

module.exports = router;
