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
    // payments with dueAmount > 0
    const due = await Payment.find({ dueAmount: { $gt: 0 } }).populate('tenant property');
    res.json(due);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
