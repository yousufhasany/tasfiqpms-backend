const mongoose = require('mongoose');

const LoanTransactionSchema = new mongoose.Schema({
  loan: { type: mongoose.Schema.Types.ObjectId, ref: 'Loan', required: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'OfficeProject', default: null },
  amount: { type: Number, required: true }, // negative when funding project, positive for repayments/adjustments
  date: { type: Date, required: true, default: Date.now },
  description: { type: String, required: true, trim: true },
  type: { type: String, enum: ['disbursement', 'funding', 'repayment'], required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('LoanTransaction', LoanTransactionSchema);
