const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/financeController');

// All endpoints in this file are restricted to admin and finance_manager
router.use(auth, requireRole('admin', 'finance_manager', 'manager'));

// Stats
router.get('/stats', ctrl.getStats);

// Reports
router.get('/reports', ctrl.getReports);

// Employees
router.get('/employees', ctrl.getEmployees);
router.post('/employees', ctrl.createEmployee);
router.put('/employees/:id', ctrl.updateEmployee);
router.delete('/employees/:id', ctrl.deleteEmployee);

// Salary payments
router.get('/salaries', ctrl.getSalaryPayments);
router.post('/salaries', ctrl.createSalaryPayment);
router.put('/salaries/:id', ctrl.updateSalaryPayment);
router.delete('/salaries/:id', ctrl.deleteSalaryPayment);

// Incomes
router.get('/income', ctrl.getOfficeIncomes);
router.post('/income', ctrl.createOfficeIncome);
router.put('/income/:id', ctrl.updateOfficeIncome);
router.delete('/income/:id', ctrl.deleteOfficeIncome);

// Expenses
router.get('/expense', ctrl.getOfficeExpenses);
router.post('/expense', ctrl.createOfficeExpense);
router.put('/expense/:id', ctrl.updateOfficeExpense);
router.delete('/expense/:id', ctrl.deleteOfficeExpense);

// Transfers and Loan Actions
router.post('/transfer', ctrl.transferFunds);
router.post('/loan-action', ctrl.loanAction);

module.exports = router;
