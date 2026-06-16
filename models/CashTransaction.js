const mongoose = require('mongoose');

const CashTransactionSchema = new mongoose.Schema({
  amount: { type: Number, required: true }, // positive for inflow, negative for outflow
  date: { type: Date, required: true, default: Date.now },
  description: { type: String, required: true, trim: true },
  type: { type: String, enum: ['inflow', 'outflow'], required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('CashTransaction', CashTransactionSchema);
