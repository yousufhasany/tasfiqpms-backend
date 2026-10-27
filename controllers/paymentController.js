const Payment = require('../models/Payment');
const Property = require('../models/Property');
const { syncRentPayment, removeRentPayment } = require('../services/familyLedger');

const PAYMENT_SORT = { paymentDate: -1, createdAt: -1 };

function normalizeRentMonth(value) {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{1,2})/);
  if (!match) return '';
  return `${match[1]}-${match[2].padStart(2, '0')}`;
}

exports.getPayments = async (req, res) => {
  try {
    const filter = {};
    if (req.query.property) filter.property = req.query.property;
    if (req.query.tenant) filter.tenant = req.query.tenant;

    const payments = await Payment.find(filter)
      .populate('tenant property')
      .sort(PAYMENT_SORT);
    res.json(payments);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.createPayment = async (req, res) => {
  try {
    const { property, tenant, amount, paymentDate, rentMonth, notes } = req.body;

    const prop = await Property.findById(property);
    if (!prop) return res.status(404).json({ msg: 'Property not found' });
    if (prop.status !== 'Rented') {
      return res.status(400).json({ msg: 'Can only collect rent for rented properties' });
    }

    const month = normalizeRentMonth(rentMonth) || new Date().toISOString().slice(0, 7);
    const already = await Payment.find({ property }).select('rentMonth');
    if (already.some(item => normalizeRentMonth(item.rentMonth) === month)) {
      return res.status(400).json({ msg: 'That month is already collected. Nothing else was posted.' });
    }

    const payment = await Payment.create({
      property,
      tenant,
      amount: Number(amount),
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      rentMonth: month,
      notes: notes || ''
    });

    try { await syncRentPayment(payment); } catch (ledgerErr) {
      console.error('Family rent credit failed:', ledgerErr.message);
    }

    const populated = await Payment.findById(payment._id).populate('tenant property');
    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

exports.updatePayment = async (req, res) => {
  try {
    const { amount, paymentDate, rentMonth, notes } = req.body;
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ msg: 'Payment not found' });

    if (amount !== undefined) payment.amount = Number(amount);
    if (paymentDate !== undefined) payment.paymentDate = new Date(paymentDate);
    if (rentMonth !== undefined) payment.rentMonth = rentMonth;
    if (notes !== undefined) payment.notes = notes;

    await payment.save();
    try { await syncRentPayment(payment); } catch (ledgerErr) {
      console.error('Family rent credit failed:', ledgerErr.message);
    }
    const populated = await Payment.findById(payment._id).populate('tenant property');
    res.json(populated);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

exports.deletePayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ msg: 'Payment not found' });
    await payment.deleteOne();
    try { await removeRentPayment(payment._id); } catch (ledgerErr) {
      console.error('Family rent removal failed:', ledgerErr.message);
    }
    res.json({ msg: 'Payment deleted' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.getRentedProperties = async (req, res) => {
  try {
    const properties = await Property.find({ status: 'Rented' })
      .populate('tenant')
      .sort({ propertyName: 1 });
    res.json(properties);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};
