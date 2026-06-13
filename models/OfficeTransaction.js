const mongoose = require('mongoose');

const OfficeTransactionSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'OfficeProject', required: true },
  date: { type: Date, required: true },
  details: { type: String, default: '' },
  debit: { type: Number, default: 0 },
  credit: { type: Number, default: 0 },
  balance: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('OfficeTransaction', OfficeTransactionSchema);
