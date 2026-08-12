const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const paymentController = require('../controllers/paymentController');

const { requireRole } = require('../middleware/auth');

router.get('/rented-properties', paymentController.getRentedProperties);
router.get('/', paymentController.getPayments);
router.post('/', auth, paymentController.createPayment);
router.put('/:id', auth, requireRole('admin'), paymentController.updatePayment);
router.delete('/:id', auth, requireRole('admin'), paymentController.deletePayment);

module.exports = router;
