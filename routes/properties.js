const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const upload = require('../config/multer');
const propertyController = require('../controllers/propertyController');

router.get('/', propertyController.getProperties);
router.post('/', auth, propertyController.createProperty);
router.put('/:id/rent-price', auth, propertyController.updateRentPrice);
router.put('/:id/rent-start-date', auth, propertyController.updateRentStartDate);
router.post('/:id/rent', auth, upload.single('nidPdf'), propertyController.rentProperty);
router.get('/:id', propertyController.getProperty);
router.put('/:id', auth, propertyController.updateProperty);
router.delete('/:id', auth, propertyController.deleteProperty);

module.exports = router;
