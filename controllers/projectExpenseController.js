const mongoose = require('mongoose');
const ProjectExpense = require('../models/ProjectExpense');
const OfficeProject = require('../models/OfficeProject');
const OfficeTransaction = require('../models/OfficeTransaction');
const { recalculateBalances } = require('./officeTransactionController');

// Get project expenses
exports.getExpenses = async (req, res) => {
  try {
    const filter = {};

    // Managers can view all project expenses

    // Direct filter overrides
    if (req.query.project) {
      // If manager, check permission
      // Managers can filter by any project
      filter.project = req.query.project;
    }

    // Date range filter
    if (req.query.startDate || req.query.endDate) {
      filter.expenseDate = {};
      if (req.query.startDate) {
        filter.expenseDate.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        filter.expenseDate.$lte = new Date(req.query.endDate);
      }
    }

    const expenses = await ProjectExpense.find(filter)
      .populate('project', 'name manager')
      .populate('manager', 'name email')
      .sort({ expenseDate: -1, createdAt: -1 });

    res.json(expenses);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// Log a daily project expense
exports.createExpense = async (req, res) => {
  try {
    const { project, category, description, amount, expenseDate, paymentMethod } = req.body;

    if (!project || !category || !description || !amount || !paymentMethod) {
      return res.status(400).json({ msg: 'Please provide all required fields' });
    }

    // Check project assignment
    const proj = await OfficeProject.findById(project);
    if (!proj) {
      return res.status(404).json({ msg: 'Project not found' });
    }

    // Managers can log expenses for any project

    const expenseAmount = Number(amount);

    // Verify project available balance
    const summary = await OfficeTransaction.aggregate([
      { $match: { project: new mongoose.Types.ObjectId(project) } },
      {
        $group: {
          _id: null,
          totalDebit: { $sum: '$debit' },
          totalCredit: { $sum: '$credit' }
        }
      }
    ]);
    const currentBalance = (summary[0]?.totalCredit || 0) - (summary[0]?.totalDebit || 0);

    if (currentBalance < expenseAmount) {
      return res.status(400).json({ msg: `Insufficient project budget balance. Available: ৳${currentBalance.toFixed(2)}, Required: ৳${expenseAmount.toFixed(2)}` });
    }

    const expense = new ProjectExpense({
      project,
      manager: req.userId,
      expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
      category: category.trim(),
      description: description.trim(),
      amount: expenseAmount,
      paymentMethod: paymentMethod.trim()
    });

    if (req.file) {
      expense.attachment = {
        data: req.file.buffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size
      };
    }

    await expense.save();

    // Log the transaction in Office Transactions ledger (debit/expense)
    const details = `[Daily Expense - ${expense.category}] ${expense.description}`;
    await OfficeTransaction.create({
      project: expense.project,
      date: expense.expenseDate,
      details,
      debit: expense.amount,
      credit: 0,
      balance: 0,
      createdBy: req.userId
    });

    // Recalculate office transaction balances for this project
    await recalculateBalances(expense.project, expense.expenseDate);

    const populated = await ProjectExpense.findById(expense._id)
      .populate('project', 'name')
      .populate('manager', 'name email');

    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

// Download expense receipt attachment
exports.downloadAttachment = async (req, res) => {
  try {
    const expense = await ProjectExpense.findById(req.params.id);
    if (!expense || !expense.attachment || !expense.attachment.data) {
      return res.status(404).json({ msg: 'Attachment not found' });
    }

    res.setHeader('Content-Type', expense.attachment.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${expense.attachment.originalName || 'receipt'}"`);
    res.send(expense.attachment.data);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// Remove expense
exports.remove = async (req, res) => {
  try {
    const expense = await ProjectExpense.findById(req.params.id);
    if (!expense) return res.status(404).json({ msg: 'Expense not found' });

    // Restrict removal: only assigned manager or admin
    if (req.userRole === 'manager' && expense.manager.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const { project: projectId, expenseDate, category, description, amount } = expense;

    // Delete corresponding OfficeTransaction
    const details = `[Daily Expense - ${category}] ${description}`;
    await OfficeTransaction.deleteOne({
      project: projectId,
      debit: amount,
      details
    });

    await expense.deleteOne();

    // Recalculate office transaction balances
    await recalculateBalances(projectId, expenseDate);

    res.json({ msg: 'Daily expense and associated ledger entry deleted' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// Edit a daily project expense
exports.updateExpense = async (req, res) => {
  try {
    const { project, category, description, amount, expenseDate, paymentMethod } = req.body;
    
    const expense = await ProjectExpense.findById(req.params.id);
    if (!expense) return res.status(404).json({ msg: 'Expense not found' });

    // Restrict updates: only assigned manager or admin
    if (req.userRole === 'manager' && expense.manager.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const oldProject = expense.project;
    const oldDate = expense.expenseDate;
    const oldAmount = expense.amount;
    const oldCategory = expense.category;
    const oldDescription = expense.description;

    const newProjectId = project || oldProject;
    
    // Check project assignment for new project if changed
    const proj = await OfficeProject.findById(newProjectId);
    if (!proj) return res.status(404).json({ msg: 'Project not found' });
    // Managers can log expenses for any project

    const newAmount = amount ? Number(amount) : oldAmount;

    // Verify project available balance
    const summary = await OfficeTransaction.aggregate([
      { $match: { project: new mongoose.Types.ObjectId(newProjectId) } },
      {
        $group: {
          _id: null,
          totalDebit: { $sum: '$debit' },
          totalCredit: { $sum: '$credit' }
        }
      }
    ]);
    let currentBalance = (summary[0]?.totalCredit || 0) - (summary[0]?.totalDebit || 0);
    
    // If updating same project, temporarily add back old amount for validation
    if (newProjectId.toString() === oldProject.toString()) {
      currentBalance += oldAmount;
    }

    if (currentBalance < newAmount) {
      return res.status(400).json({ msg: `Insufficient project budget balance. Available: ৳${currentBalance.toFixed(2)}, Required: ৳${newAmount.toFixed(2)}` });
    }

    // Update expense properties
    expense.project = newProjectId;
    if (category) expense.category = category.trim();
    if (description) expense.description = description.trim();
    expense.amount = newAmount;
    if (expenseDate) expense.expenseDate = new Date(expenseDate);
    if (paymentMethod) expense.paymentMethod = paymentMethod.trim();

    if (req.file) {
      expense.attachment = {
        data: req.file.buffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size
      };
    }

    await expense.save();

    // Find and update the associated OfficeTransaction
    const oldDetails = `[Daily Expense - ${oldCategory}] ${oldDescription}`;
    const officeTxn = await OfficeTransaction.findOne({
      project: oldProject,
      debit: oldAmount,
      details: oldDetails
    });

    const newDetails = `[Daily Expense - ${expense.category}] ${expense.description}`;
    if (officeTxn) {
      officeTxn.project = expense.project;
      officeTxn.date = expense.expenseDate;
      officeTxn.details = newDetails;
      officeTxn.debit = expense.amount;
      await officeTxn.save();
    } else {
      // Recreate the transaction if not found
      await OfficeTransaction.create({
        project: expense.project,
        date: expense.expenseDate,
        details: newDetails,
        debit: expense.amount,
        credit: 0,
        balance: 0,
        createdBy: expense.manager
      });
    }

    // Recalculate balances
    await recalculateBalances(oldProject, oldDate);
    if (oldProject.toString() !== newProjectId.toString() || oldDate.getTime() !== expense.expenseDate.getTime()) {
      await recalculateBalances(newProjectId, expense.expenseDate);
    }

    const populated = await ProjectExpense.findById(expense._id)
      .populate('project', 'name')
      .populate('manager', 'name email');

    res.json(populated);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};
