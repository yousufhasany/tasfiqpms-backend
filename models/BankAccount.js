const mongoose = require('mongoose');

const BankAccountSchema = new mongoose.Schema({
  bankName: { type: String, required: true, trim: true },
  accountName: { type: String, required: true, trim: true },
  accountNumber: { type: String, default: '', trim: true },
  openingBalance: { type: Number, required: true, default: 0 },
  currentBalance: { type: Number, required: true, default: 0 },
  date: { type: Date, required: true, default: Date.now },
  notes: { type: String, default: '', trim: true }
}, { timestamps: true });

module.exports = mongoose.model('BankAccount', BankAccountSchema);
