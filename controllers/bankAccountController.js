const BankAccount = require('../models/BankAccount');
const BankAccountTransaction = require('../models/BankAccountTransaction');

// Get all bank accounts
exports.getAll = async (req, res) => {
  try {
    const accounts = await BankAccount.find().sort({ createdAt: -1 });
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// Create a bank account
exports.create = async (req, res) => {
  try {
    const { bankName, accountName, accountNumber, openingBalance, date, notes } = req.body;
    if (!bankName || !accountName || openingBalance === undefined) {
      return res.status(400).json({ msg: 'Please provide Bank Name, Account Name, and Opening Balance' });
    }

    const account = new BankAccount({
      bankName: bankName.trim(),
      accountName: accountName.trim(),
      accountNumber: accountNumber ? accountNumber.trim() : '',
      openingBalance: Number(openingBalance),
      currentBalance: Number(openingBalance),
      date: date ? new Date(date) : new Date(),
      notes: notes ? notes.trim() : ''
    });

    await account.save();

    // Log the initial deposit transaction for the bank account
    if (Number(openingBalance) > 0) {
      await BankAccountTransaction.create({
        bankAccount: account._id,
        amount: Number(openingBalance),
        date: account.date,
        description: 'Opening Balance Deposit',
        type: 'deposit',
        createdBy: req.userId || null
      });
    }

    res.status(201).json(account);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

// Delete a bank account
exports.remove = async (req, res) => {
  try {
    const account = await BankAccount.findById(req.params.id);
    if (!account) return res.status(404).json({ msg: 'Bank account not found' });

    // Delete associated transactions
    await BankAccountTransaction.deleteMany({ bankAccount: account._id });
    await account.deleteOne();

    res.json({ msg: 'Bank account and transaction history deleted' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// Edit a bank account
exports.update = async (req, res) => {
  try {
    const { bankName, accountName, accountNumber, openingBalance, date, notes } = req.body;
    const account = await BankAccount.findById(req.params.id);
    if (!account) return res.status(404).json({ msg: 'Bank account not found' });

    const oldOpeningBalance = account.openingBalance;
    const newOpeningBalance = openingBalance !== undefined ? Number(openingBalance) : oldOpeningBalance;

    const balanceDiff = newOpeningBalance - oldOpeningBalance;

    if (account.currentBalance + balanceDiff < 0) {
      return res.status(400).json({ msg: 'Cannot reduce opening balance: account balance would fall below zero' });
    }

    account.bankName = bankName ? bankName.trim() : account.bankName;
    account.accountName = accountName ? accountName.trim() : account.accountName;
    account.accountNumber = accountNumber !== undefined ? accountNumber.trim() : account.accountNumber;
    account.notes = notes !== undefined ? notes.trim() : account.notes;
    account.openingBalance = newOpeningBalance;
    account.currentBalance = account.currentBalance + balanceDiff;
    if (date) account.date = new Date(date);

    await account.save();

    // Manage the initial deposit transaction for the opening balance
    const initialTx = await BankAccountTransaction.findOne({ bankAccount: account._id, description: 'Opening Balance Deposit' });
    if (initialTx) {
      if (newOpeningBalance > 0) {
        initialTx.amount = newOpeningBalance;
        if (date) initialTx.date = account.date;
        await initialTx.save();
      } else {
        // If updated opening balance is 0, delete the initial transaction record
        await initialTx.deleteOne();
      }
    } else if (newOpeningBalance > 0) {
      // Create if it didn't exist before
      await BankAccountTransaction.create({
        bankAccount: account._id,
        amount: newOpeningBalance,
        date: account.date,
        description: 'Opening Balance Deposit',
        type: 'deposit',
        createdBy: req.userId || null
      });
    }

    res.json(account);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

