const Property = require('../models/Property');
const Payment = require('../models/Payment');
const OfficeTransaction = require('../models/OfficeTransaction');
const BankTransaction = require('../models/BankTransaction');

exports.getStats = async (req, res) => {
  try {
    const [totalProperties, availableProperties, rentedProperties] = await Promise.all([
      Property.countDocuments(),
      Property.countDocuments({ status: 'Available' }),
      Property.countDocuments({ status: 'Rented' })
    ]);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [monthlyAgg, totalAgg, officeAgg, bankAgg] = await Promise.all([
      Payment.aggregate([
        { $match: { paymentDate: { $gte: startOfMonth, $lt: endOfMonth } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Payment.aggregate([
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      OfficeTransaction.aggregate([
        {
          $group: {
            _id: null,
            totalDebit: { $sum: '$debit' },
            totalCredit: { $sum: '$credit' }
          }
        }
      ]),
      BankTransaction.aggregate([
        {
          $group: {
            _id: null,
            totalDebit: { $sum: '$debit' },
            totalCredit: { $sum: '$credit' }
          }
        }
      ])
    ]);

    // Get current balances from latest transactions
    const latestTxn = await OfficeTransaction.findOne().sort({ date: -1, createdAt: -1 });
    const latestBankTxn = await BankTransaction.findOne().sort({ date: -1, createdAt: -1 });

    res.json({
      totalProperties,
      availableProperties,
      rentedProperties,
      monthlyIncome: monthlyAgg[0]?.total || 0,
      totalIncome: totalAgg[0]?.total || 0,
      // Office Transaction summary
      officeTotalDebit: officeAgg[0]?.totalDebit || 0,
      officeTotalCredit: officeAgg[0]?.totalCredit || 0,
      officeNetBalance: (officeAgg[0]?.totalCredit || 0) - (officeAgg[0]?.totalDebit || 0),
      officeCurrentBalance: latestTxn?.balance ?? 0,
      // Bank Transaction summary
      bankTotalDebit: bankAgg[0]?.totalDebit || 0,
      bankTotalCredit: bankAgg[0]?.totalCredit || 0,
      bankNetBalance: (bankAgg[0]?.totalCredit || 0) - (bankAgg[0]?.totalDebit || 0),
      bankCurrentBalance: latestBankTxn?.balance ?? 0
    });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.getOfficeSummary = async (req, res) => {
  try {
    const BankAccount = require('../models/BankAccount');
    const CashTransaction = require('../models/CashTransaction');
    const Loan = require('../models/Loan');
    const OfficeTransaction = require('../models/OfficeTransaction');

    const [bankAccounts, cashAgg, loans, officeTxnSummary] = await Promise.all([
      BankAccount.find(),
      CashTransaction.aggregate([
        { $group: { _id: null, balance: { $sum: '$amount' } } }
      ]),
      Loan.find(),
      OfficeTransaction.aggregate([
        {
          $group: {
            _id: null,
            totalInvestment: { $sum: '$credit' },
            totalExpenses: { $sum: '$debit' }
          }
        }
      ])
    ]);

    const totalBankBalance = bankAccounts.reduce((sum, b) => sum + b.currentBalance, 0);
    const cashInHand = cashAgg[0]?.balance || 0;
    const totalLoanAmount = loans.reduce((sum, l) => sum + l.amount, 0);
    const totalLoanRemainingBalance = loans.reduce((sum, l) => sum + l.currentBalance, 0);
    
    // Total Available Funds is unassigned money in banks, cash in hand, and remaining loan credit
    const totalAvailableFunds = totalBankBalance + cashInHand + totalLoanRemainingBalance;

    const totalProjectInvestment = officeTxnSummary[0]?.totalInvestment || 0;
    const totalProjectExpenses = officeTxnSummary[0]?.totalExpenses || 0;
    const projectRemainingBalance = totalProjectInvestment - totalProjectExpenses;

    // Remaining Overall Balance = Unassigned Available Funds + Remaining Project Balances
    const remainingOverallBalance = totalAvailableFunds + projectRemainingBalance;

    res.json({
      totalBankBalance,
      cashInHand,
      totalLoanAmount,
      totalAvailableFunds,
      totalProjectInvestment,
      totalProjectExpenses,
      remainingOverallBalance
    });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};
