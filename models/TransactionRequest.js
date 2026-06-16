const mongoose = require('mongoose');

const TransactionRequestSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'OfficeProject', required: true },
  manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  paymentType: { type: String, enum: ['Cash', 'Bank Transfer', 'Mobile Banking'], required: true },
  amount: { type: Number, required: true, min: 1 },
  description: { type: String, required: true, trim: true },
  date: { type: Date, required: true },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  remarks: { type: String, default: '', trim: true },
  sourceType: { type: String, enum: ['Bank', 'Cash', 'Loan'] },
  bankAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'BankAccount', default: null },
  loan: { type: mongoose.Schema.Types.ObjectId, ref: 'Loan', default: null }
}, { timestamps: true });

module.exports = mongoose.model('TransactionRequest', TransactionRequestSchema);
