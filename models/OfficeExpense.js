const mongoose = require('mongoose');

const OfficeExpenseSchema = new mongoose.Schema({
  date: { type: Date, required: true, default: Date.now },
  category: { 
    type: String, 
    enum: ['Office Expense', 'Utility Bills', 'Internet', 'Transportation', 'Food', 'Equipment', 'Maintenance', 'Other', 'Salary'],
    required: true 
  },
  amount: { type: Number, required: true },
  paymentMethod: { type: String, enum: ['Cash', 'Bank', 'Mobile Banking'], required: true },
  bankAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'BankAccount', default: null },
  cashTransaction: { type: mongoose.Schema.Types.ObjectId, ref: 'CashTransaction', default: null },
  bankTransaction: { type: mongoose.Schema.Types.ObjectId, ref: 'BankAccountTransaction', default: null },
  description: { type: String, default: '', trim: true },
  salaryPayment: { type: mongoose.Schema.Types.ObjectId, ref: 'SalaryPayment', default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('OfficeExpense', OfficeExpenseSchema);
