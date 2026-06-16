const TransactionRequest = require('../models/TransactionRequest');
const OfficeProject = require('../models/OfficeProject');
const OfficeTransaction = require('../models/OfficeTransaction');
const { recalculateBalances } = require('./officeTransactionController');

// Submit transaction request (Managers only)
exports.createRequest = async (req, res) => {
  try {
    const { project, paymentType, amount, description, date } = req.body;
    if (!project || !paymentType || !amount || !description || !date) {
      return res.status(400).json({ msg: 'Please provide all required fields' });
    }

    // Check project assignment
    const proj = await OfficeProject.findById(project);
    if (!proj) {
      return res.status(404).json({ msg: 'Project not found' });
    }

    // If manager, verify they are assigned to this project
    if (req.userRole === 'manager' && (!proj.manager || proj.manager.toString() !== req.userId)) {
      return res.status(403).json({ msg: 'Access denied: not your assigned project' });
    }

    const request = new TransactionRequest({
      project,
      manager: req.userId,
      paymentType,
      amount: Number(amount),
      description: description.trim(),
      date: new Date(date),
      status: 'Pending'
    });

    await request.save();
    
    const populated = await TransactionRequest.findById(request._id)
      .populate('project', 'name')
      .populate('manager', 'name email');

    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

// List transaction requests (Admins see all; managers see their own)
exports.getRequests = async (req, res) => {
  try {
    const filter = {};
    if (req.userRole === 'manager') {
      filter.manager = req.userId;
    } else if (req.query.project) {
      filter.project = req.query.project;
    }

    const requests = await TransactionRequest.find(filter)
      .populate('project', 'name')
      .populate('manager', 'name email')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// Revert the financial impact of an approved request
const revertApproval = async (request) => {
  if (request.status !== 'Approved') return;

  const BankAccount = require('../models/BankAccount');
  const BankAccountTransaction = require('../models/BankAccountTransaction');
  const CashTransaction = require('../models/CashTransaction');
  const Loan = require('../models/Loan');
  const LoanTransaction = require('../models/LoanTransaction');
  const OfficeTransaction = require('../models/OfficeTransaction');
  const OfficeProject = require('../models/OfficeProject');

  const proj = await OfficeProject.findById(request.project);
  const projName = proj ? proj.name : 'Project';

  // Revert source deduction
  if (request.sourceType === 'Bank' && request.bankAccount) {
    const bank = await BankAccount.findById(request.bankAccount);
    if (bank) {
      bank.currentBalance += request.amount;
      await bank.save();
    }
    await BankAccountTransaction.deleteOne({
      project: request.project,
      amount: -request.amount,
      date: request.date,
      type: 'funding'
    });
  } else if (request.sourceType === 'Cash') {
    // Delete cash transaction inflow/outflow
    await CashTransaction.deleteOne({
      amount: -request.amount,
      date: request.date,
      type: 'outflow',
      description: `Funding for project: ${projName}`
    });
  } else if (request.sourceType === 'Loan' && request.loan) {
    const loan = await Loan.findById(request.loan);
    if (loan) {
      loan.currentBalance += request.amount;
      if (loan.status === 'Paid') {
        loan.status = 'Unpaid';
      }
      await loan.save();
    }
    await LoanTransaction.deleteOne({
      loan: request.loan,
      project: request.project,
      amount: -request.amount,
      date: request.date,
      type: 'funding'
    });
  }

  // Delete associated credit OfficeTransaction
  await OfficeTransaction.deleteOne({
    project: request.project,
    date: request.date,
    credit: request.amount,
    details: { $regex: 'Funding Approved' }
  });
};

// Apply approval logic helper
const applyApproval = async (request, reqBody, reqUserId) => {
  const { sourceType, sourceId, allowNegative, remarks } = reqBody;
  if (!sourceType) {
    throw new Error('Please select a money source for approval');
  }

  const BankAccount = require('../models/BankAccount');
  const BankAccountTransaction = require('../models/BankAccountTransaction');
  const CashTransaction = require('../models/CashTransaction');
  const Loan = require('../models/Loan');
  const LoanTransaction = require('../models/LoanTransaction');
  const OfficeProject = require('../models/OfficeProject');
  const OfficeTransaction = require('../models/OfficeTransaction');

  const proj = await OfficeProject.findById(request.project);
  const projName = proj ? proj.name : 'Project';

  if (sourceType === 'Bank') {
    if (!sourceId) throw new Error('Please select a Bank Account');
    const bank = await BankAccount.findById(sourceId);
    if (!bank) throw new Error('Bank Account not found');
    if (bank.currentBalance < request.amount && !allowNegative) {
      throw new Error(`Insufficient bank balance. Available: ৳${bank.currentBalance}`);
    }

    bank.currentBalance -= request.amount;
    await bank.save();

    await BankAccountTransaction.create({
      bankAccount: bank._id,
      project: request.project,
      amount: -request.amount,
      date: request.date,
      description: `Funding for project: ${projName}`,
      type: 'funding',
      createdBy: reqUserId
    });
    request.bankAccount = bank._id;
    request.loan = null;
  } else if (sourceType === 'Cash') {
    const balanceAgg = await CashTransaction.aggregate([
      { $group: { _id: null, balance: { $sum: '$amount' } } }
    ]);
    const currentCash = balanceAgg[0]?.balance || 0;
    if (currentCash < request.amount && !allowNegative) {
      throw new Error(`Insufficient cash in hand. Available: ৳${currentCash}`);
    }

    await CashTransaction.create({
      amount: -request.amount,
      date: request.date,
      description: `Funding for project: ${projName}`,
      type: 'outflow',
      createdBy: reqUserId
    });
    request.bankAccount = null;
    request.loan = null;
  } else if (sourceType === 'Loan') {
    if (!sourceId) throw new Error('Please select a Loan');
    const loan = await Loan.findById(sourceId);
    if (!loan) throw new Error('Loan not found');
    if (loan.status === 'Paid') {
      throw new Error('Selected loan is already paid off');
    }
    if (loan.currentBalance < request.amount && !allowNegative) {
      throw new Error(`Insufficient loan balance. Available: ৳${loan.currentBalance}`);
    }

    loan.currentBalance -= request.amount;
    await loan.save();

    await LoanTransaction.create({
      loan: loan._id,
      project: request.project,
      amount: -request.amount,
      date: request.date,
      description: `Funding for project: ${projName}`,
      type: 'funding',
      createdBy: reqUserId
    });
    request.loan = loan._id;
    request.bankAccount = null;
  } else {
    throw new Error('Invalid money source type');
  }

  request.status = 'Approved';
  request.sourceType = sourceType;
  request.remarks = remarks || '';
  await request.save();

  // Create office transaction credit entry
  const details = `[Funding Approved - ${sourceType}] ${request.description}` + 
    (remarks ? ` (Admin Remarks: ${remarks})` : '');

  await OfficeTransaction.create({
    project: request.project,
    date: request.date,
    details,
    debit: 0,
    credit: request.amount,
    balance: 0,
    createdBy: request.manager
  });
};

// Approve transaction request (Admin only)
exports.approveRequest = async (req, res) => {
  try {
    const request = await TransactionRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ msg: 'Transaction request not found' });
    }

    if (request.status !== 'Pending') {
      return res.status(400).json({ msg: `Request has already been ${request.status.toLowerCase()}` });
    }

    await applyApproval(request, req.body, req.userId);
    await recalculateBalances(request.project, request.date);

    res.json({ msg: 'Request approved and office transaction recorded', request });
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

// Reject transaction request (Admin only)
exports.rejectRequest = async (req, res) => {
  try {
    const { remarks } = req.body;
    const request = await TransactionRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ msg: 'Transaction request not found' });
    }

    if (request.status !== 'Pending') {
      return res.status(400).json({ msg: `Request has already been ${request.status.toLowerCase()}` });
    }

    request.status = 'Rejected';
    request.remarks = remarks || '';
    await request.save();

    res.json({ msg: 'Request rejected', request });
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

// Edit transaction request (Admin only)
exports.updateRequest = async (req, res) => {
  try {
    const { project, paymentType, amount, description, date, status, sourceType, sourceId, allowNegative, remarks } = req.body;
    const request = await TransactionRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ msg: 'Transaction request not found' });

    const wasApproved = request.status === 'Approved';
    const oldProject = request.project;
    const oldDate = request.date;

    // 1. Revert previous approval if it was approved
    if (wasApproved) {
      await revertApproval(request);
    }

    // 2. Apply updates
    if (project) request.project = project;
    if (paymentType) request.paymentType = paymentType;
    if (amount) request.amount = Number(amount);
    if (description) request.description = description.trim();
    if (date) request.date = new Date(date);
    if (status) request.status = status;
    if (remarks !== undefined) request.remarks = remarks;

    // 3. Handle new/restored state
    if (request.status === 'Approved') {
      // Re-apply approval with either submitted parameters or previous parameters
      const approvalData = {
        sourceType: sourceType || request.sourceType,
        sourceId: sourceId || request.bankAccount || request.loan,
        allowNegative: allowNegative !== undefined ? allowNegative : false,
        remarks: remarks !== undefined ? remarks : request.remarks
      };
      await applyApproval(request, approvalData, req.userId);
    } else {
      // Reset approved properties
      request.bankAccount = null;
      request.loan = null;
      request.sourceType = undefined;
      await request.save();
    }

    // Recalculate balances
    await recalculateBalances(oldProject, oldDate);
    if (oldProject.toString() !== request.project.toString() || oldDate.getTime() !== request.date.getTime()) {
      await recalculateBalances(request.project, request.date);
    }

    const populated = await TransactionRequest.findById(request._id)
      .populate('project', 'name')
      .populate('manager', 'name email');

    res.json(populated);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

// Delete transaction request (Admin only)
exports.deleteRequest = async (req, res) => {
  try {
    const request = await TransactionRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ msg: 'Transaction request not found' });

    const wasApproved = request.status === 'Approved';
    const oldProject = request.project;
    const oldDate = request.date;

    if (wasApproved) {
      await revertApproval(request);
    }

    await request.deleteOne();

    if (wasApproved) {
      await recalculateBalances(oldProject, oldDate);
    }

    res.json({ msg: 'Transaction request deleted successfully' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

