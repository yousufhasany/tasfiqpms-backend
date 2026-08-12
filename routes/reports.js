const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const Agreement = require('../models/Agreement');

// GET /api/reports/monthly-income?year=2026
router.get('/monthly-income', async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);

    const agg = await Payment.aggregate([
      { $match: { paymentDate: { $gte: start, $lt: end } } },
      { $group: { _id: { $month: '$paymentDate' }, total: { $sum: '$amountPaid' } } },
      { $sort: { _id: 1 } }
    ]);
    res.json(agg);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// GET /api/reports/export/monthly-income?year=2026
router.get('/export/monthly-income', async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);

    const agg = await Payment.aggregate([
      { $match: { paymentDate: { $gte: start, $lt: end } } },
      { $group: { _id: { $month: '$paymentDate' }, total: { $sum: '$amountPaid' } } },
      { $sort: { _id: 1 } }
    ]);

    // build CSV
    let csv = 'Month,Total\n';
    for (let i = 1; i <= 12; i++) {
      const row = agg.find(a => a._id === i);
      csv += `${i},${row ? row.total : 0}\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=monthly-income-${year}.csv`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// GET /api/reports/due-payments
router.get('/due-payments', async (req, res) => {
  try {
    const due = await Payment.find({ dueAmount: { $gt: 0 } }).populate('tenant property');
    res.json(due);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// --- OFFICE MANAGEMENT REPORTS ---

const auth = require('../middleware/auth');
const BankAccountTransaction = require('../models/BankAccountTransaction');
const CashTransaction = require('../models/CashTransaction');
const LoanTransaction = require('../models/LoanTransaction');
const TransactionRequest = require('../models/TransactionRequest');
const ProjectExpense = require('../models/ProjectExpense');
const OfficeProject = require('../models/OfficeProject');
const OfficeTransaction = require('../models/OfficeTransaction');

// Helper to enforce manager project boundaries
async function getProjectFilter(req) {
  if (req.query.project) {
    return { project: req.query.project };
  }
  return {};
}

// 1. Bank Transactions Report
router.get('/office/bank', auth, async (req, res) => {
  try {
    const filter = await getProjectFilter(req);
    
    if (req.query.bankAccount) {
      filter.bankAccount = req.query.bankAccount;
    }
    
    if (req.query.startDate || req.query.endDate) {
      filter.date = {};
      if (req.query.startDate) filter.date.$gte = new Date(req.query.startDate);
      if (req.query.endDate) filter.date.$lte = new Date(req.query.endDate);
    }
    
    const txns = await BankAccountTransaction.find(filter)
      .populate('bankAccount', 'bankName accountName accountNumber')
      .populate('project', 'name')
      .sort({ date: -1, createdAt: -1 });
      
    res.json(txns);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
});

// 2. Cash Transactions Report
router.get('/office/cash', auth, async (req, res) => {
  try {
    // Cash report is visible to Manager 1
    
    const filter = {};
    if (req.query.startDate || req.query.endDate) {
      filter.date = {};
      if (req.query.startDate) filter.date.$gte = new Date(req.query.startDate);
      if (req.query.endDate) filter.date.$lte = new Date(req.query.endDate);
    }
    
    const txns = await CashTransaction.find(filter).sort({ date: -1, createdAt: -1 });
    res.json(txns);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// 3. Loan Transactions Report
router.get('/office/loans', auth, async (req, res) => {
  try {
    // Loans report is visible to Manager 1

    const filter = {};
    if (req.query.loan) {
      filter.loan = req.query.loan;
    }
    if (req.query.startDate || req.query.endDate) {
      filter.date = {};
      if (req.query.startDate) filter.date.$gte = new Date(req.query.startDate);
      if (req.query.endDate) filter.date.$lte = new Date(req.query.endDate);
    }
    
    const txns = await LoanTransaction.find(filter)
      .populate('loan', 'lenderName amount')
      .populate('project', 'name')
      .sort({ date: -1, createdAt: -1 });
      
    res.json(txns);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// 4. Project Funding Report (Approved requests)
router.get('/office/funding', auth, async (req, res) => {
  try {
    const filter = await getProjectFilter(req);
    filter.status = 'Approved';
    
    if (req.query.startDate || req.query.endDate) {
      filter.date = {};
      if (req.query.startDate) filter.date.$gte = new Date(req.query.startDate);
      if (req.query.endDate) filter.date.$lte = new Date(req.query.endDate);
    }
    
    const funding = await TransactionRequest.find(filter)
      .populate('project', 'name')
      .populate('manager', 'name email')
      .populate('bankAccount', 'bankName accountName')
      .populate('loan', 'lenderName')
      .sort({ date: -1, createdAt: -1 });
      
    res.json(funding);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
});

// 5. Daily Project Expenses Report
router.get('/office/expenses', auth, async (req, res) => {
  try {
    const filter = await getProjectFilter(req);
    
    if (req.query.startDate || req.query.endDate) {
      filter.expenseDate = {};
      if (req.query.startDate) filter.expenseDate.$gte = new Date(req.query.startDate);
      if (req.query.endDate) filter.expenseDate.$lte = new Date(req.query.endDate);
    }
    
    const expenses = await ProjectExpense.find(filter)
      .populate('project', 'name')
      .populate('manager', 'name email')
      .sort({ expenseDate: -1, createdAt: -1 });
      
    res.json(expenses);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
});

// 6. Project Financial Summary Report
router.get('/office/project-summary', auth, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    let projectIds = [];
    
    if (req.query.project) {
      projectIds = [new mongoose.Types.ObjectId(req.query.project)];
    } else {
      const projects = await OfficeProject.find();
      projectIds = projects.map(p => p._id);
    }

    const summaries = await Promise.all(projectIds.map(async (pId) => {
      const project = await OfficeProject.findById(pId)
        .populate('manager', 'name email');
        
      if (!project) return null;
      
      const [officeTxnAgg, pendingAgg, budgetHistory] = await Promise.all([
        OfficeTransaction.aggregate([
          { $match: { project: pId } },
          {
            $group: {
              _id: null,
              totalApprovedBudget: { $sum: '$credit' },
              totalExpenses: { $sum: '$debit' }
            }
          }
        ]),
        TransactionRequest.aggregate([
          { $match: { project: pId, status: 'Pending' } },
          { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
        ]),
        OfficeTransaction.find({ project: pId, credit: { $gt: 0 } })
          .sort({ date: -1 })
      ]);
      
      const totalApprovedBudget = officeTxnAgg[0]?.totalApprovedBudget || 0;
      const totalExpenses = officeTxnAgg[0]?.totalExpenses || 0;
      const remainingBalance = totalApprovedBudget - totalExpenses;
      const pendingRequestsAmount = pendingAgg[0]?.total || 0;
      const pendingRequestsCount = pendingAgg[0]?.count || 0;
      
      return {
        project: {
          _id: project._id,
          name: project.name,
          status: project.status,
          manager: project.manager
        },
        totalApprovedBudget,
        totalExpenses,
        remainingBalance,
        pendingRequestsAmount,
        pendingRequestsCount,
        budgetHistory
      };
    }));
    
    res.json(summaries.filter(Boolean));
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
