const Property = require('../models/Property');
const Payment = require('../models/Payment');

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

    const [monthlyAgg, totalAgg, monthlyChart] = await Promise.all([
      Payment.aggregate([
        { $match: { paymentDate: { $gte: startOfMonth, $lt: endOfMonth } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Payment.aggregate([
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Payment.aggregate([
        {
          $match: {
            paymentDate: {
              $gte: new Date(now.getFullYear(), 0, 1),
              $lt: new Date(now.getFullYear() + 1, 0, 1)
            }
          }
        },
        { $group: { _id: { $month: '$paymentDate' }, total: { $sum: '$amount' } } },
        { $sort: { _id: 1 } }
      ])
    ]);

    res.json({
      totalProperties,
      availableProperties,
      rentedProperties,
      monthlyIncome: monthlyAgg[0]?.total || 0,
      totalIncome: totalAgg[0]?.total || 0,
      monthlyChart
    });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};
