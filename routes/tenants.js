const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const upload = require('../config/multer');
const tenantController = require('../controllers/tenantController');

router.get('/', tenantController.getTenants);
router.get('/:id', tenantController.getTenant);
router.put('/:id', auth, upload.single('nidPdf'), tenantController.updateTenant);
router.post('/:id/documents', auth, upload.single('document'), tenantController.uploadDocument);
router.delete('/:id', auth, tenantController.deleteTenant);

module.exports = router;
