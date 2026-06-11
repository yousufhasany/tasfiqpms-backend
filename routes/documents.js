const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');

router.get('/', documentController.getDocuments);
router.get('/tenant/:tenantId/nid', documentController.getNIDDocument);
router.get('/:id/download', documentController.downloadDocument);

module.exports = router;
