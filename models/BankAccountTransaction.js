const mongoose = require('mongoose');

const BankAccountTransactionSchema = new mongoose.Schema({
  bankAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'BankAccount', required: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'OfficeProject', default: null },
  amount: { type: Number, required: true }, // positive for deposit, negative for withdraw/funding
  date: { type: Date, required: true, default: Date.now },
  description: { type: String, required: true, trim: true },
  type: { type: String, enum: ['deposit', 'withdraw', 'funding'], required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('BankAccountTransaction', BankAccountTransactionSchema);
