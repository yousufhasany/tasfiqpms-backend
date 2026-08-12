const mongoose = require('mongoose');

const OfficeIncomeSchema = new mongoose.Schema({
  date: { type: Date, required: true, default: Date.now },
  incomeSource: { type: String, required: true, trim: true },
  amount: { type: Number, required: true },
  paymentMethod: { type: String, enum: ['Cash', 'Bank', 'Mobile Banking'], required: true },
  bankAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'BankAccount', default: null },
  cashTransaction: { type: mongoose.Schema.Types.ObjectId, ref: 'CashTransaction', default: null },
  bankTransaction: { type: mongoose.Schema.Types.ObjectId, ref: 'BankAccountTransaction', default: null },
  description: { type: String, default: '', trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('OfficeIncome', OfficeIncomeSchema);
