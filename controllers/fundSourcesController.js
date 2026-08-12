const CashTransaction = require('../models/CashTransaction');
const Loan = require('../models/Loan');
const LoanTransaction = require('../models/LoanTransaction');

// --- CASH CONTROLLERS ---

// Get all cash transactions and current balance
exports.getCashTransactions = async (req, res) => {
  try {
    const transactions = await CashTransaction.find().sort({ date: -1, createdAt: -1 });
    
    const balanceAgg = await CashTransaction.aggregate([
      { $group: { _id: null, balance: { $sum: '$amount' } } }
    ]);
    const currentBalance = balanceAgg[0]?.balance || 0;

    res.json({ transactions, currentBalance });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// Create a cash transaction (inflow/outflow)
exports.createCashTransaction = async (req, res) => {
  try {
    const { amount, date, description, type } = req.body;
    if (!amount || !description || !type) {
      return res.status(400).json({ msg: 'Please provide Amount, Description, and Type' });
    }

    const value = type === 'inflow' ? Math.abs(Number(amount)) : -Math.abs(Number(amount));

    // If outflow, check cash balance
    if (value < 0) {
      const balanceAgg = await CashTransaction.aggregate([
        { $group: { _id: null, balance: { $sum: '$amount' } } }
      ]);
      const currentBalance = balanceAgg[0]?.balance || 0;
      if (currentBalance + value < 0) {
        return res.status(400).json({ msg: 'Insufficient cash in hand to complete this transaction' });
      }
    }

    const tx = new CashTransaction({
      amount: value,
      date: date ? new Date(date) : new Date(),
      description: description.trim(),
      type,
      createdBy: req.userId || null
    });

    await tx.save();
    res.status(201).json(tx);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

// --- LOAN CONTROLLERS ---

// Get all loans and summaries
exports.getLoans = async (req, res) => {
  try {
    const loans = await Loan.find().sort({ date: -1, createdAt: -1 });

    const totalAgg = await Loan.aggregate([
      { 
        $group: { 
          _id: null, 
          total: { $sum: '$amount' }, 
          remaining: { $sum: '$currentBalance' },
          totalRemainingBalance: { $sum: '$remainingBalance' },
          totalPaidAmount: { $sum: '$totalPaid' }
        } 
      }
    ]);
    const totalLoanAmount = totalAgg[0]?.total || 0;
    const remainingLoanBalance = totalAgg[0]?.remaining || 0;
    const totalRemainingBalance = totalAgg[0]?.totalRemainingBalance || 0;
    const totalPaidAmount = totalAgg[0]?.totalPaidAmount || 0;

    res.json({ 
      loans, 
      totalLoanAmount, 
      remainingLoanBalance, 
      totalRemainingBalance, 
      totalPaidAmount 
    });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// Create a loan
exports.createLoan = async (req, res) => {
  try {
    const { lenderName, amount, date, description } = req.body;
    if (!lenderName || !amount || !description) {
      return res.status(400).json({ msg: 'Please provide Lender Name, Amount, and Description' });
    }

    const loan = new Loan({
      lenderName: lenderName.trim(),
      amount: Number(amount),
      currentBalance: Number(amount),
      remainingBalance: Number(amount),
      totalPaid: 0,
      date: date ? new Date(date) : new Date(),
      description: description.trim(),
      status: 'Unpaid'
    });

    await loan.save();

    // Log the initial loan disbursement transaction
    await LoanTransaction.create({
      loan: loan._id,
      amount: Number(amount),
      date: loan.date,
      description: `Disbursement from lender: ${loan.lenderName}`,
      type: 'disbursement',
      createdBy: req.userId || null
    });

    res.status(201).json(loan);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

// Toggle status of loan (Paid / Unpaid)
exports.toggleLoanStatus = async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan) return res.status(404).json({ msg: 'Loan not found' });

    if (loan.status === 'Fully Paid') {
      loan.status = 'Unpaid';
      loan.totalPaid = 0;
      loan.remainingBalance = loan.amount;
      loan.repayments = [];

      // Clean up previous repayment transactions for this loan
      await LoanTransaction.deleteMany({ loan: loan._id, type: 'repayment' });
    } else {
      const repayAmount = loan.remainingBalance;
      if (repayAmount > 0) {
        loan.repayments.push({
          amount: repayAmount,
          date: new Date(),
          paymentMethod: 'Cash',
          notes: 'Status manually toggled to Paid'
        });

        await LoanTransaction.create({
          loan: loan._id,
          amount: repayAmount,
          date: new Date(),
          description: 'Repayment via Cash - Status manually toggled to Paid',
          type: 'repayment',
          createdBy: req.userId || null
        });

        loan.totalPaid = loan.amount;
        loan.remainingBalance = 0;
      }
      loan.status = 'Fully Paid';
    }

    await loan.save();
    res.json(loan);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

// Edit a cash transaction
exports.updateCashTransaction = async (req, res) => {
  try {
    const { amount, date, description, type } = req.body;
    const tx = await CashTransaction.findById(req.params.id);
    if (!tx) return res.status(404).json({ msg: 'Cash transaction not found' });

    const oldValue = tx.amount;
    const value = type === 'inflow' ? Math.abs(Number(amount)) : -Math.abs(Number(amount));

    // Check balance if outflow or amount changed
    const balanceAgg = await CashTransaction.aggregate([
      { $group: { _id: null, balance: { $sum: '$amount' } } }
    ]);
    const currentBalance = balanceAgg[0]?.balance || 0;
    // Temporarily revert the old value to check if the new value would keep the balance >= 0
    if (currentBalance - oldValue + value < 0) {
      return res.status(400).json({ msg: 'Insufficient cash in hand to complete this change' });
    }

    tx.amount = value;
    if (date) tx.date = new Date(date);
    if (description) tx.description = description.trim();
    if (type) tx.type = type;
    await tx.save();

    res.json(tx);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

// Delete a cash transaction
exports.deleteCashTransaction = async (req, res) => {
  try {
    const tx = await CashTransaction.findById(req.params.id);
    if (!tx) return res.status(404).json({ msg: 'Cash transaction not found' });

    // Check balance if we remove this transaction (only relevant if we remove an inflow)
    if (tx.amount > 0) {
      const balanceAgg = await CashTransaction.aggregate([
        { $group: { _id: null, balance: { $sum: '$amount' } } }
      ]);
      const currentBalance = balanceAgg[0]?.balance || 0;
      if (currentBalance - tx.amount < 0) {
        return res.status(400).json({ msg: 'Cannot delete: cash balance would fall below zero' });
      }
    }

    await tx.deleteOne();
    res.json({ msg: 'Cash transaction deleted successfully' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// Edit a loan
exports.updateLoan = async (req, res) => {
  try {
    const { lenderName, amount, date, description } = req.body;
    const loan = await Loan.findById(req.params.id);
    if (!loan) return res.status(404).json({ msg: 'Loan not found' });

    const oldAmount = loan.amount;
    const newAmount = amount ? Number(amount) : oldAmount;
    
    // Adjust currentBalance based on amount difference
    const drawnBudget = oldAmount - loan.currentBalance;
    if (newAmount < drawnBudget) {
      return res.status(400).json({ msg: `Cannot reduce loan amount below currently used funds: ৳${drawnBudget}` });
    }

    if (newAmount < loan.totalPaid) {
      return res.status(400).json({ msg: `Cannot reduce loan amount below the amount already repaid: ৳${loan.totalPaid}` });
    }

    loan.lenderName = lenderName ? lenderName.trim() : loan.lenderName;
    loan.amount = newAmount;
    loan.currentBalance = newAmount - drawnBudget;
    loan.remainingBalance = newAmount - loan.totalPaid;
    
    // Recalculate status based on repayments
    if (loan.remainingBalance === 0) {
      loan.status = 'Fully Paid';
    } else if (loan.totalPaid > 0) {
      loan.status = 'Partially Paid';
    } else {
      loan.status = 'Unpaid';
    }

    if (date) loan.date = new Date(date);
    if (description) loan.description = description.trim();

    await loan.save();

    // Also update the initial disbursement transaction
    const initialTx = await LoanTransaction.findOne({ loan: loan._id, type: 'disbursement' });
    if (initialTx) {
      initialTx.amount = newAmount;
      if (date) initialTx.date = loan.date;
      initialTx.description = `Disbursement from lender: ${loan.lenderName}`;
      await initialTx.save();
    }

    res.json(loan);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

// Delete a loan and its transactions
exports.deleteLoan = async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan) return res.status(404).json({ msg: 'Loan not found' });

    // Check if this loan has active project funding
    const fundingTxCount = await LoanTransaction.countDocuments({ loan: loan._id, type: 'funding' });
    if (fundingTxCount > 0) {
      return res.status(400).json({ msg: 'Cannot delete: this loan has active project funding allocations. Delete those allocations or requests first.' });
    }

    // Delete all associated loan transactions
    await LoanTransaction.deleteMany({ loan: loan._id });
    await loan.deleteOne();

    res.json({ msg: 'Loan and its disbursement records deleted successfully' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// Get all loan transactions
exports.getLoanTransactions = async (req, res) => {
  try {
    const filter = {};
    if (req.query.loan) filter.loan = req.query.loan;
    const txns = await LoanTransaction.find(filter)
      .populate('loan', 'lenderName amount')
      .populate('project', 'name')
      .sort({ date: -1, createdAt: -1 });
    res.json(txns);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// Edit a loan transaction
exports.updateLoanTransaction = async (req, res) => {
  try {
    const { amount, date, description, type } = req.body;
    const txn = await LoanTransaction.findById(req.params.id);
    if (!txn) return res.status(404).json({ msg: 'Loan transaction not found' });

    const loan = await Loan.findById(txn.loan);
    if (!loan) return res.status(404).json({ msg: 'Associated loan not found' });

    if (txn.type === 'disbursement') {
      return res.status(400).json({ msg: 'To edit disbursement amount, please edit the Loan itself.' });
    }

    const oldAmount = txn.amount;
    const newAmount = Number(amount);

    // Adjust Loan currentBalance
    const balanceDiff = newAmount - oldAmount;
    if (loan.currentBalance + balanceDiff < 0) {
      return res.status(400).json({ msg: 'Insufficient loan balance for this change' });
    }
    if (loan.currentBalance + balanceDiff > loan.amount) {
      return res.status(400).json({ msg: 'Loan balance cannot exceed the loan principal amount' });
    }

    loan.currentBalance += balanceDiff;
    await loan.save();

    txn.amount = newAmount;
    if (date) txn.date = new Date(date);
    if (description) txn.description = description.trim();
    if (type) txn.type = type;
    await txn.save();

    res.json(txn);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

// Delete a loan transaction
exports.deleteLoanTransaction = async (req, res) => {
  try {
    const txn = await LoanTransaction.findById(req.params.id);
    if (!txn) return res.status(404).json({ msg: 'Loan transaction not found' });

    if (txn.type === 'disbursement') {
      return res.status(400).json({ msg: 'To delete disbursement transaction, please delete the Loan itself.' });
    }

    const loan = await Loan.findById(txn.loan);
    if (loan) {
      loan.currentBalance -= txn.amount;
      await loan.save();
    }

    await txn.deleteOne();
    res.json({ msg: 'Loan transaction deleted successfully' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// Record a loan repayment
exports.repayLoan = async (req, res) => {
  try {
    const { amount, date, paymentMethod, notes } = req.body;
    if (!amount || !paymentMethod) {
      return res.status(400).json({ msg: 'Please provide Repayment Amount and Payment Method' });
    }

    const loan = await Loan.findById(req.params.id);
    if (!loan) return res.status(404).json({ msg: 'Loan not found' });

    const repaymentAmount = Number(amount);
    if (isNaN(repaymentAmount) || repaymentAmount <= 0) {
      return res.status(400).json({ msg: 'Repayment amount must be a positive number' });
    }

    if (repaymentAmount > loan.remainingBalance) {
      return res.status(400).json({ msg: `Repayment amount (৳${repaymentAmount}) cannot exceed the remaining balance (৳${loan.remainingBalance})` });
    }

    // Append the repayment
    loan.repayments.push({
      amount: repaymentAmount,
      date: date ? new Date(date) : new Date(),
      paymentMethod,
      notes: notes ? notes.trim() : ''
    });

    // Update totals and status
    loan.totalPaid += repaymentAmount;
    loan.remainingBalance = loan.amount - loan.totalPaid;

    if (loan.remainingBalance === 0) {
      loan.status = 'Fully Paid';
    } else {
      loan.status = 'Partially Paid';
    }

    await loan.save();

    // Log the transaction in LoanTransaction
    await LoanTransaction.create({
      loan: loan._id,
      amount: repaymentAmount,
      date: date ? new Date(date) : new Date(),
      description: `Repayment via ${paymentMethod}${notes ? ' - ' + notes.trim() : ''}`,
      type: 'repayment',
      createdBy: req.userId || null
    });

    res.json(loan);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

