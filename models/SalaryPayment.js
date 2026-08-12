const mongoose = require('mongoose');

const SalaryPaymentSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  amount: { type: Number, required: true },
  paymentDate: { type: Date, required: true, default: Date.now },
  paymentMethod: { type: String, enum: ['Cash', 'Bank', 'Mobile Banking'], required: true },
  bankAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'BankAccount', default: null },
  notes: { type: String, default: '', trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('SalaryPayment', SalaryPaymentSchema);
