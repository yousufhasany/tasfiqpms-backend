const Payment = require('../models/Payment');
const Property = require('../models/Property');

const PAYMENT_SORT = { paymentDate: -1, createdAt: -1 };

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
    const { property, tenant, amount, paymentDate, notes } = req.body;

    const prop = await Property.findById(property);
    if (!prop) return res.status(404).json({ msg: 'Property not found' });
    if (prop.status !== 'Rented') {
      return res.status(400).json({ msg: 'Can only collect rent for rented properties' });
    }

    const payment = await Payment.create({
      property,
      tenant,
      amount: Number(amount),
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      notes: notes || ''
    });

    const populated = await Payment.findById(payment._id).populate('tenant property');
    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

exports.updatePayment = async (req, res) => {
  try {
    const { amount, paymentDate, notes } = req.body;
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ msg: 'Payment not found' });

    if (amount !== undefined) payment.amount = Number(amount);
    if (paymentDate !== undefined) payment.paymentDate = new Date(paymentDate);
    if (notes !== undefined) payment.notes = notes;

    await payment.save();
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
