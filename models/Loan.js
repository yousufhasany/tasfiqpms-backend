const mongoose = require('mongoose');

const LoanSchema = new mongoose.Schema({
  lenderName: { type: String, required: true, trim: true },
  amount: { type: Number, required: true },
  currentBalance: { type: Number, required: true }, // starts at amount, goes down as project funding is approved
  date: { type: Date, required: true, default: Date.now },
  description: { type: String, required: true, trim: true },
  status: { type: String, enum: ['Unpaid', 'Paid'], default: 'Unpaid' }
}, { timestamps: true });

module.exports = mongoose.model('Loan', LoanSchema);
