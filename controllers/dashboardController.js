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
