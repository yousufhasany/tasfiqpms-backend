const mongoose = require('mongoose');

const RepaymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  date: { type: Date, required: true, default: Date.now },
  paymentMethod: { type: String, required: true, enum: ['Cash', 'Bank Transfer', 'Mobile Banking'] },
  notes: { type: String, default: '', trim: true }
});

const LoanSchema = new mongoose.Schema({
  lenderName: { type: String, required: true, trim: true },
  amount: { type: Number, required: true },
  currentBalance: { type: Number, required: true }, // starts at amount, goes down as project funding is approved
  date: { type: Date, required: true, default: Date.now },
  description: { type: String, required: true, trim: true },
  totalPaid: { type: Number, required: true, default: 0 },
  remainingBalance: { type: Number, required: true },
  status: { type: String, enum: ['Unpaid', 'Partially Paid', 'Fully Paid'], default: 'Unpaid' },
  repayments: [RepaymentSchema]
}, { timestamps: true });

module.exports = mongoose.model('Loan', LoanSchema);

