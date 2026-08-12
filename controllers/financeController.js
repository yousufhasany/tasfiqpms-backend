const Employee = require('../models/Employee');
const SalaryPayment = require('../models/SalaryPayment');
const OfficeExpense = require('../models/OfficeExpense');
const OfficeIncome = require('../models/OfficeIncome');
const User = require('../models/User');
const BankAccount = require('../models/BankAccount');
const BankAccountTransaction = require('../models/BankAccountTransaction');
const CashTransaction = require('../models/CashTransaction');
const Loan = require('../models/Loan');
const LoanTransaction = require('../models/LoanTransaction');

// Helper to check if a record was created by an Admin
const isAdminRecord = async (record) => {
  if (!record || !record.createdBy) return false;
  const creator = await User.findById(record.createdBy);
  return creator && creator.role === 'admin';
};

// Helper middleware check for Finance Manager writing over Admin records
const verifyWritePermission = async (record, req, res) => {
  if (req.userRole === 'finance_manager') {
    const isOwnerAdmin = await isAdminRecord(record);
    if (isOwnerAdmin) {
      res.status(403).json({ msg: 'Access denied: Finance Manager cannot modify or delete admin records' });
      return false;
    }
  }
  return true;
};

// ==========================================
// EMPLOYEES CRUD
// ==========================================

exports.getEmployees = async (req, res) => {
  try {
    const employees = await Employee.find().populate('createdBy', 'name email role').sort({ name: 1 });
    res.json(employees);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.createEmployee = async (req, res) => {
  try {
    const { name, designation, monthlySalary } = req.body;
    if (!name || !designation || !monthlySalary) {
      return res.status(400).json({ msg: 'Please provide all required fields' });
    }
    const emp = new Employee({
      name: name.trim(),
      designation: designation.trim(),
      monthlySalary: Number(monthlySalary),
      createdBy: req.userId
    });
    await emp.save();
    res.status(201).json(emp);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

exports.updateEmployee = async (req, res) => {
  try {
    const { name, designation, monthlySalary } = req.body;
    const emp = await Employee.findById(req.params.id);
    if (!emp) return res.status(404).json({ msg: 'Employee not found' });

    const hasPerm = await verifyWritePermission(emp, req, res);
    if (!hasPerm) return;

    if (name !== undefined) emp.name = name.trim();
    if (designation !== undefined) emp.designation = designation.trim();
    if (monthlySalary !== undefined) emp.monthlySalary = Number(monthlySalary);

    await emp.save();
    res.json(emp);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

exports.deleteEmployee = async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id);
    if (!emp) return res.status(404).json({ msg: 'Employee not found' });

    const hasPerm = await verifyWritePermission(emp, req, res);
    if (!hasPerm) return;

    // Check if employee has salary payments
    const paymentsCount = await SalaryPayment.countDocuments({ employee: emp._id });
    if (paymentsCount > 0) {
      return res.status(400).json({ msg: 'Cannot delete employee with recorded salary payments' });
    }

    await emp.deleteOne();
    res.json({ msg: 'Employee deleted' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// ==========================================
// SALARY PAYMENTS CRUD
// ==========================================

exports.getSalaryPayments = async (req, res) => {
  try {
    const payments = await SalaryPayment.find()
      .populate('employee')
      .populate('bankAccount')
      .populate('createdBy', 'name email role')
      .sort({ paymentDate: -1, createdAt: -1 });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// Helper: apply financial impact of an office expense
const applyExpenseImpact = async (expense, reqUserId) => {
  const amount = Number(expense.amount);
  if (expense.paymentMethod === 'Cash') {
    const cashTx = await CashTransaction.create({
      amount: -amount,
      date: expense.date,
      description: `Office Expense: ${expense.category} - ${expense.description}`,
      type: 'outflow',
      createdBy: reqUserId
    });
    expense.cashTransaction = cashTx._id;
  } else {
    // Bank or Mobile Banking
    const bank = await BankAccount.findById(expense.bankAccount);
    if (!bank) throw new Error('Bank account not found');
    bank.currentBalance -= amount;
    await bank.save();

    const bankTx = await BankAccountTransaction.create({
      bankAccount: bank._id,
      amount: -amount,
      date: expense.date,
      description: `Office Expense: ${expense.category} - ${expense.description}`,
      type: 'withdraw',
      createdBy: reqUserId
    });
    expense.bankTransaction = bankTx._id;
  }
};

// Helper: revert financial impact of an office expense
const revertExpenseImpact = async (expense) => {
  if (expense.paymentMethod === 'Cash' && expense.cashTransaction) {
    await CashTransaction.findByIdAndDelete(expense.cashTransaction);
    expense.cashTransaction = null;
  } else if (expense.bankTransaction) {
    const bankTx = await BankAccountTransaction.findById(expense.bankTransaction);
    if (bankTx) {
      const bank = await BankAccount.findById(bankTx.bankAccount);
      if (bank) {
        bank.currentBalance -= bankTx.amount; // bankTx.amount is negative, so this adds it back
        await bank.save();
      }
      await bankTx.deleteOne();
    }
    expense.bankTransaction = null;
  }
};

// Helper: apply financial impact of an office income
const applyIncomeImpact = async (income, reqUserId) => {
  const amount = Number(income.amount);
  if (income.paymentMethod === 'Cash') {
    const cashTx = await CashTransaction.create({
      amount: amount,
      date: income.date,
      description: `Office Income: ${income.incomeSource} - ${income.description}`,
      type: 'inflow',
      createdBy: reqUserId
    });
    income.cashTransaction = cashTx._id;
  } else {
    // Bank or Mobile Banking
    const bank = await BankAccount.findById(income.bankAccount);
    if (!bank) throw new Error('Bank account not found');
    bank.currentBalance += amount;
    await bank.save();

    const bankTx = await BankAccountTransaction.create({
      bankAccount: bank._id,
      amount: amount,
      date: income.date,
      description: `Office Income: ${income.incomeSource} - ${income.description}`,
      type: 'deposit',
      createdBy: reqUserId
    });
    income.bankTransaction = bankTx._id;
  }
};

// Helper: revert financial impact of an office income
const revertIncomeImpact = async (income) => {
  if (income.paymentMethod === 'Cash' && income.cashTransaction) {
    await CashTransaction.findByIdAndDelete(income.cashTransaction);
    income.cashTransaction = null;
  } else if (income.bankTransaction) {
    const bankTx = await BankAccountTransaction.findById(income.bankTransaction);
    if (bankTx) {
      const bank = await BankAccount.findById(bankTx.bankAccount);
      if (bank) {
        bank.currentBalance -= bankTx.amount; // bankTx.amount is positive, so this subtracts it
        await bank.save();
      }
      await bankTx.deleteOne();
    }
    income.bankTransaction = null;
  }
};

exports.createSalaryPayment = async (req, res) => {
  try {
    const { employee, amount, paymentDate, paymentMethod, bankAccount, notes } = req.body;
    if (!employee || !amount || !paymentDate || !paymentMethod) {
      return res.status(400).json({ msg: 'Please provide all required fields' });
    }

    const emp = await Employee.findById(employee);
    if (!emp) return res.status(404).json({ msg: 'Employee not found' });

    // Save payment
    const payment = new SalaryPayment({
      employee,
      amount: Number(amount),
      paymentDate: new Date(paymentDate),
      paymentMethod,
      bankAccount: bankAccount || null,
      notes: notes || '',
      createdBy: req.userId
    });
    await payment.save();

    // Automatically create Office Expense record
    const expense = new OfficeExpense({
      date: payment.paymentDate,
      category: 'Salary',
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      bankAccount: payment.bankAccount,
      description: `Salary Payment to ${emp.name} (${emp.designation}). Notes: ${payment.notes}`,
      salaryPayment: payment._id,
      createdBy: req.userId
    });

    // Apply financial impact
    await applyExpenseImpact(expense, req.userId);
    await expense.save();

    res.status(201).json(payment);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

exports.updateSalaryPayment = async (req, res) => {
  try {
    const { amount, paymentDate, paymentMethod, bankAccount, notes } = req.body;
    const payment = await SalaryPayment.findById(req.params.id);
    if (!payment) return res.status(404).json({ msg: 'Salary payment record not found' });

    const hasPerm = await verifyWritePermission(payment, req, res);
    if (!hasPerm) return;

    // Find associated office expense
    const expense = await OfficeExpense.findOne({ salaryPayment: payment._id });
    if (expense) {
      // Revert old impact
      await revertExpenseImpact(expense);
    }

    // Apply updates
    if (amount !== undefined) payment.amount = Number(amount);
    if (paymentDate !== undefined) payment.paymentDate = new Date(paymentDate);
    if (paymentMethod !== undefined) payment.paymentMethod = paymentMethod;
    if (bankAccount !== undefined) payment.bankAccount = bankAccount || null;
    if (notes !== undefined) payment.notes = notes || '';

    await payment.save();

    if (expense) {
      const emp = await Employee.findById(payment.employee);
      expense.date = payment.paymentDate;
      expense.amount = payment.amount;
      expense.paymentMethod = payment.paymentMethod;
      expense.bankAccount = payment.bankAccount;
      expense.description = `Salary Payment to ${emp ? emp.name : 'Employee'}. Notes: ${payment.notes}`;

      // Apply new impact
      await applyExpenseImpact(expense, req.userId);
      await expense.save();
    }

    res.json(payment);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

exports.deleteSalaryPayment = async (req, res) => {
  try {
    const payment = await SalaryPayment.findById(req.params.id);
    if (!payment) return res.status(404).json({ msg: 'Salary payment record not found' });

    const hasPerm = await verifyWritePermission(payment, req, res);
    if (!hasPerm) return;

    // Find and delete associated Office Expense
    const expense = await OfficeExpense.findOne({ salaryPayment: payment._id });
    if (expense) {
      await revertExpenseImpact(expense);
      await expense.deleteOne();
    }

    await payment.deleteOne();
    res.json({ msg: 'Salary payment record and associated office expense deleted' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// ==========================================
// OFFICE INCOME CRUD
// ==========================================

exports.getOfficeIncomes = async (req, res) => {
  try {
    const incomes = await OfficeIncome.find()
      .populate('bankAccount')
      .populate('createdBy', 'name email role')
      .sort({ date: -1, createdAt: -1 });
    res.json(incomes);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.createOfficeIncome = async (req, res) => {
  try {
    const { date, incomeSource, amount, paymentMethod, bankAccount, description } = req.body;
    if (!incomeSource || !amount || !date || !paymentMethod) {
      return res.status(400).json({ msg: 'Please provide all required fields' });
    }

    const income = new OfficeIncome({
      date: new Date(date),
      incomeSource: incomeSource.trim(),
      amount: Number(amount),
      paymentMethod,
      bankAccount: bankAccount || null,
      description: description || '',
      createdBy: req.userId
    });

    await applyIncomeImpact(income, req.userId);
    await income.save();

    res.status(201).json(income);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

exports.updateOfficeIncome = async (req, res) => {
  try {
    const { date, incomeSource, amount, paymentMethod, bankAccount, description } = req.body;
    const income = await OfficeIncome.findById(req.params.id);
    if (!income) return res.status(404).json({ msg: 'Income record not found' });

    const hasPerm = await verifyWritePermission(income, req, res);
    if (!hasPerm) return;

    // Revert old impact
    await revertIncomeImpact(income);

    // Apply updates
    if (date !== undefined) income.date = new Date(date);
    if (incomeSource !== undefined) income.incomeSource = incomeSource.trim();
    if (amount !== undefined) income.amount = Number(amount);
    if (paymentMethod !== undefined) income.paymentMethod = paymentMethod;
    if (bankAccount !== undefined) income.bankAccount = bankAccount || null;
    if (description !== undefined) income.description = description || '';

    // Apply new impact
    await applyIncomeImpact(income, req.userId);
    await income.save();

    res.json(income);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

exports.deleteOfficeIncome = async (req, res) => {
  try {
    const income = await OfficeIncome.findById(req.params.id);
    if (!income) return res.status(404).json({ msg: 'Income record not found' });

    const hasPerm = await verifyWritePermission(income, req, res);
    if (!hasPerm) return;

    await revertIncomeImpact(income);
    await income.deleteOne();

    res.json({ msg: 'Income record deleted successfully' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// ==========================================
// OFFICE EXPENSE CRUD
// ==========================================

exports.getOfficeExpenses = async (req, res) => {
  try {
    const expenses = await OfficeExpense.find()
      .populate('bankAccount')
      .populate('salaryPayment')
      .populate('createdBy', 'name email role')
      .sort({ date: -1, createdAt: -1 });
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.createOfficeExpense = async (req, res) => {
  try {
    const { date, category, amount, paymentMethod, bankAccount, description } = req.body;
    if (!category || !amount || !date || !paymentMethod) {
      return res.status(400).json({ msg: 'Please provide all required fields' });
    }

    const expense = new OfficeExpense({
      date: new Date(date),
      category,
      amount: Number(amount),
      paymentMethod,
      bankAccount: bankAccount || null,
      description: description || '',
      createdBy: req.userId
    });

    await applyExpenseImpact(expense, req.userId);
    await expense.save();

    res.status(201).json(expense);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

exports.updateOfficeExpense = async (req, res) => {
  try {
    const { date, category, amount, paymentMethod, bankAccount, description } = req.body;
    const expense = await OfficeExpense.findById(req.params.id);
    if (!expense) return res.status(404).json({ msg: 'Expense record not found' });

    const hasPerm = await verifyWritePermission(expense, req, res);
    if (!hasPerm) return;

    if (expense.salaryPayment) {
      return res.status(400).json({ msg: 'Cannot edit salary payments directly through expenses. Please use the Salary module.' });
    }

    // Revert old impact
    await revertExpenseImpact(expense);

    // Apply updates
    if (date !== undefined) expense.date = new Date(date);
    if (category !== undefined) expense.category = category;
    if (amount !== undefined) expense.amount = Number(amount);
    if (paymentMethod !== undefined) expense.paymentMethod = paymentMethod;
    if (bankAccount !== undefined) expense.bankAccount = bankAccount || null;
    if (description !== undefined) expense.description = description || '';

    // Apply new impact
    await applyExpenseImpact(expense, req.userId);
    await expense.save();

    res.json(expense);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

exports.deleteOfficeExpense = async (req, res) => {
  try {
    const expense = await OfficeExpense.findById(req.params.id);
    if (!expense) return res.status(404).json({ msg: 'Expense record not found' });

    const hasPerm = await verifyWritePermission(expense, req, res);
    if (!hasPerm) return;

    if (expense.salaryPayment) {
      return res.status(400).json({ msg: 'Cannot delete salary payments directly through expenses. Please use the Salary module.' });
    }

    await revertExpenseImpact(expense);
    await expense.deleteOne();

    res.json({ msg: 'Expense record deleted successfully' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// ==========================================
// BANK & CASH MANAGEMENT ACTIONS
// ==========================================

exports.transferFunds = async (req, res) => {
  try {
    const { fromType, toType, amount, bankAccountId, date, description } = req.body;
    if (!fromType || !toType || !amount || !date) {
      return res.status(400).json({ msg: 'Please provide all required fields' });
    }

    const value = Number(amount);
    const transferDate = new Date(date);
    const notes = description ? description.trim() : 'Cash/Bank Transfer';

    if (fromType === 'Cash' && toType === 'Bank') {
      // Deposit cash into bank account
      if (!bankAccountId) return res.status(400).json({ msg: 'Please select a destination bank account' });
      const bank = await BankAccount.findById(bankAccountId);
      if (!bank) return res.status(404).json({ msg: 'Destination bank account not found' });

      // Create Cash Outflow
      await CashTransaction.create({
        amount: -value,
        date: transferDate,
        description: `Transfer to Bank: ${bank.bankName} (${bank.accountName})`,
        type: 'outflow',
        createdBy: req.userId
      });

      // Increase bank balance
      bank.currentBalance += value;
      await bank.save();

      // Create Bank Deposit Transaction
      await BankAccountTransaction.create({
        bankAccount: bank._id,
        amount: value,
        date: transferDate,
        description: `Deposit: ${notes}`,
        type: 'deposit',
        createdBy: req.userId
      });

      return res.status(201).json({ msg: 'Deposit recorded successfully' });
    } else if (fromType === 'Bank' && toType === 'Cash') {
      // Withdraw cash from bank account
      if (!bankAccountId) return res.status(400).json({ msg: 'Please select a source bank account' });
      const bank = await BankAccount.findById(bankAccountId);
      if (!bank) return res.status(404).json({ msg: 'Source bank account not found' });

      if (bank.currentBalance < value) {
        return res.status(400).json({ msg: `Insufficient bank balance. Available: ৳${bank.currentBalance}` });
      }

      // Deduct from Bank balance
      bank.currentBalance -= value;
      await bank.save();

      // Create Bank Withdrawal Transaction
      await BankAccountTransaction.create({
        bankAccount: bank._id,
        amount: -value,
        date: transferDate,
        description: `Withdrawal: ${notes}`,
        type: 'withdraw',
        createdBy: req.userId
      });

      // Create Cash Inflow
      await CashTransaction.create({
        amount: value,
        date: transferDate,
        description: `Withdrawal from Bank: ${bank.bankName} (${bank.accountName})`,
        type: 'inflow',
        createdBy: req.userId
      });

      return res.status(201).json({ msg: 'Withdrawal recorded successfully' });
    } else {
      return res.status(400).json({ msg: 'Invalid transfer types' });
    }
  } catch (err) {
    res.status(500).json({ msg: err.message || 'Server error' });
  }
};

exports.loanAction = async (req, res) => {
  try {
    const { actionType, lenderName, loanId, amount, date, description, paymentMethod, bankAccountId } = req.body;
    if (!actionType || !amount || !date || !paymentMethod) {
      return res.status(400).json({ msg: 'Please provide all required fields' });
    }

    const value = Number(amount);
    const actionDate = new Date(date);
    const notes = description ? description.trim() : '';

    if (actionType === 'received') {
      if (!lenderName) return res.status(400).json({ msg: 'Lender Name is required for loan disbursement' });

      // Create Loan
      const loan = new Loan({
        lenderName: lenderName.trim(),
        amount: value,
        currentBalance: value,
        date: actionDate,
        description: notes || `Disbursement from ${lenderName}`,
        status: 'Unpaid'
      });
      await loan.save();

      // Log loan transaction
      await LoanTransaction.create({
        loan: loan._id,
        amount: value,
        date: actionDate,
        description: notes || `Disbursement from lender: ${loan.lenderName}`,
        type: 'disbursement',
        createdBy: req.userId
      });

      // Receive funds to Cash or Bank
      if (paymentMethod === 'Cash') {
        await CashTransaction.create({
          amount: value,
          date: actionDate,
          description: `Loan Received (Cash): ${loan.lenderName}`,
          type: 'inflow',
          createdBy: req.userId
        });
      } else {
        if (!bankAccountId) return res.status(400).json({ msg: 'Please select a bank account' });
        const bank = await BankAccount.findById(bankAccountId);
        if (!bank) return res.status(404).json({ msg: 'Bank account not found' });

        bank.currentBalance += value;
        await bank.save();

        await BankAccountTransaction.create({
          bankAccount: bank._id,
          amount: value,
          date: actionDate,
          description: `Loan Received (Bank): ${loan.lenderName}`,
          type: 'deposit',
          createdBy: req.userId
        });
      }

      return res.status(201).json(loan);
    } else if (actionType === 'repayment') {
      if (!loanId) return res.status(400).json({ msg: 'Loan selection is required' });
      const loan = await Loan.findById(loanId);
      if (!loan) return res.status(404).json({ msg: 'Loan record not found' });

      // Repay loan
      await LoanTransaction.create({
        loan: loan._id,
        amount: value,
        date: actionDate,
        description: notes || `Repayment to: ${loan.lenderName}`,
        type: 'repayment',
        createdBy: req.userId
      });

      // Update Loan currentBalance (debt reduced, status can toggle if paid off)
      // Note: repayments decrease outstanding balance, so we can adjust or toggle loan status.
      // Let's check repayments sum to see if we toggle it
      const txs = await LoanTransaction.find({ loan: loan._id });
      const totalRepaid = txs.reduce((sum, tx) => sum + (tx.type === 'repayment' ? tx.amount : 0), 0) + value;
      if (totalRepaid >= loan.amount) {
        loan.status = 'Paid';
      }
      await loan.save();

      // Deduct funds from Cash or Bank
      if (paymentMethod === 'Cash') {
        await CashTransaction.create({
          amount: -value,
          date: actionDate,
          description: `Loan Repayment (Cash): ${loan.lenderName}`,
          type: 'outflow',
          createdBy: req.userId
        });
      } else {
        if (!bankAccountId) return res.status(400).json({ msg: 'Please select a bank account' });
        const bank = await BankAccount.findById(bankAccountId);
        if (!bank) return res.status(404).json({ msg: 'Bank account not found' });

        bank.currentBalance -= value;
        await bank.save();

        await BankAccountTransaction.create({
          bankAccount: bank._id,
          amount: -value,
          date: actionDate,
          description: `Loan Repayment (Bank): ${loan.lenderName}`,
          type: 'withdraw',
          createdBy: req.userId
        });
      }

      return res.status(201).json({ msg: 'Loan repayment recorded successfully' });
    } else {
      return res.status(400).json({ msg: 'Invalid action type' });
    }
  } catch (err) {
    res.status(500).json({ msg: err.message || 'Server error' });
  }
};

// ==========================================
// FINANCE DASHBOARD STATS
// ==========================================

exports.getStats = async (req, res) => {
  try {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    const [
      todayIncomeAgg,
      todayExpenseAgg,
      monthlyIncomeAgg,
      monthlyExpenseAgg,
      cashAgg,
      bankAccounts,
      loans,
      salaryAgg
    ] = await Promise.all([
      OfficeIncome.aggregate([
        { $match: { date: { $gte: startOfToday, $lt: endOfToday } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      OfficeExpense.aggregate([
        { $match: { date: { $gte: startOfToday, $lt: endOfToday } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      OfficeIncome.aggregate([
        { $match: { date: { $gte: startOfMonth, $lt: endOfMonth } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      OfficeExpense.aggregate([
        { $match: { date: { $gte: startOfMonth, $lt: endOfMonth } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      CashTransaction.aggregate([
        { $group: { _id: null, balance: { $sum: '$amount' } } }
      ]),
      BankAccount.find(),
      Loan.find(),
      SalaryPayment.aggregate([
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);

    const cashInHand = cashAgg[0]?.balance || 0;
    const bankBalance = bankAccounts.reduce((sum, b) => sum + b.currentBalance, 0);
    // Loan balance is outstanding loan principal minus repayments
    // Or we can show total loan balance from models
    const loanBalance = loans.reduce((sum, l) => sum + l.currentBalance, 0);

    res.json({
      todayIncome: todayIncomeAgg[0]?.total || 0,
      todayExpenses: todayExpenseAgg[0]?.total || 0,
      monthlyIncome: monthlyIncomeAgg[0]?.total || 0,
      monthlyExpenses: monthlyExpenseAgg[0]?.total || 0,
      cashInHand,
      bankBalance,
      loanBalance,
      salaryExpenses: salaryAgg[0]?.total || 0,
      officeBalance: cashInHand + bankBalance
    });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// ==========================================
// REPORTS
// ==========================================

exports.getReports = async (req, res) => {
  try {
    const { reportType, startDate, endDate } = req.query;
    if (!reportType) return res.status(400).json({ msg: 'Report type is required' });

    const filter = {};
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) {
        // Extend end date to the end of that day
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    let data = [];

    switch (reportType) {
      case 'dailyCashBook': {
        // Inflows and Outflows from cash
        const cashFilter = {};
        if (startDate || endDate) {
          cashFilter.date = {};
          if (startDate) cashFilter.date.$gte = new Date(startDate);
          if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            cashFilter.date.$lte = end;
          }
        }
        data = await CashTransaction.find(cashFilter).sort({ date: -1, createdAt: -1 });
        break;
      }
      case 'monthlyIncome': {
        data = await OfficeIncome.find(filter)
          .populate('bankAccount')
          .sort({ date: -1, createdAt: -1 });
        break;
      }
      case 'monthlyExpenses': {
        data = await OfficeExpense.find(filter)
          .populate('bankAccount')
          .sort({ date: -1, createdAt: -1 });
        break;
      }
      case 'salaryPayments': {
        const salaryFilter = {};
        if (startDate || endDate) {
          salaryFilter.paymentDate = {};
          if (startDate) salaryFilter.paymentDate.$gte = new Date(startDate);
          if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            salaryFilter.paymentDate.$lte = end;
          }
        }
        data = await SalaryPayment.find(salaryFilter)
          .populate('employee')
          .populate('bankAccount')
          .sort({ paymentDate: -1, createdAt: -1 });
        break;
      }
      case 'bankTransactions': {
        const bankFilter = {};
        if (startDate || endDate) {
          bankFilter.date = {};
          if (startDate) bankFilter.date.$gte = new Date(startDate);
          if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            bankFilter.date.$lte = end;
          }
        }
        data = await BankAccountTransaction.find(bankFilter)
          .populate('bankAccount')
          .sort({ date: -1, createdAt: -1 });
        break;
      }
      case 'cashTransactions': {
        const cashFilter = {};
        if (startDate || endDate) {
          cashFilter.date = {};
          if (startDate) cashFilter.date.$gte = new Date(startDate);
          if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            cashFilter.date.$lte = end;
          }
        }
        data = await CashTransaction.find(cashFilter).sort({ date: -1, createdAt: -1 });
        break;
      }
      case 'financialSummary': {
        // Calculate totals in date range
        const incFilter = { ...filter };
        const expFilter = { ...filter };

        const [incomeSum, expenseSum, salarySum, cashSum, bankAccounts, loans] = await Promise.all([
          OfficeIncome.aggregate([
            { $match: incFilter },
            { $group: { _id: null, total: { $sum: '$amount' } } }
          ]),
          OfficeExpense.aggregate([
            { $match: expFilter },
            { $group: { _id: null, total: { $sum: '$amount' } } }
          ]),
          SalaryPayment.aggregate([
            {
              $match: startDate || endDate 
                ? { paymentDate: { ...expFilter.date } } 
                : {}
            },
            { $group: { _id: null, total: { $sum: '$amount' } } }
          ]),
          CashTransaction.aggregate([
            { $group: { _id: null, total: { $sum: '$amount' } } }
          ]),
          BankAccount.find(),
          Loan.find()
        ]);

        const totalIncome = incomeSum[0]?.total || 0;
        const totalExpenses = expenseSum[0]?.total || 0;
        const totalSalary = salarySum[0]?.total || 0;
        const cashBalance = cashSum[0]?.total || 0;
        const bankBalance = bankAccounts.reduce((sum, b) => sum + b.currentBalance, 0);
        const loanBalance = loans.reduce((sum, l) => sum + l.currentBalance, 0);

        data = {
          totalIncome,
          totalExpenses,
          totalSalary,
          cashBalance,
          bankBalance,
          loanBalance,
          netFlow: totalIncome - totalExpenses
        };
        break;
      }
      default:
        return res.status(400).json({ msg: 'Invalid report type' });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ msg: err.message || 'Server error' });
  }
};
