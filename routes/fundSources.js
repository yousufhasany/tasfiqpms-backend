const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/fundSourcesController');

// Cash routes
router.get('/cash', auth, requireRole('admin', 'office'), ctrl.getCashTransactions);
router.post('/cash', auth, requireRole('admin'), ctrl.createCashTransaction);
router.put('/cash/:id', auth, requireRole('admin'), ctrl.updateCashTransaction);
router.delete('/cash/:id', auth, requireRole('admin'), ctrl.deleteCashTransaction);

// Loan routes
router.get('/loans', auth, requireRole('admin', 'office'), ctrl.getLoans);
router.post('/loans', auth, requireRole('admin'), ctrl.createLoan);
router.put('/loans/:id/status', auth, requireRole('admin'), ctrl.toggleLoanStatus);
router.put('/loans/:id', auth, requireRole('admin'), ctrl.updateLoan);
router.delete('/loans/:id', auth, requireRole('admin'), ctrl.deleteLoan);

// Loan transactions
router.get('/loan-transactions', auth, requireRole('admin', 'office'), ctrl.getLoanTransactions);
router.put('/loan-transactions/:id', auth, requireRole('admin'), ctrl.updateLoanTransaction);
router.delete('/loan-transactions/:id', auth, requireRole('admin'), ctrl.deleteLoanTransaction);

module.exports = router;
