const mongoose = require('mongoose');

const FamilyTransactionSchema = new mongoose.Schema({
  member: { type: mongoose.Schema.Types.ObjectId, ref: 'FamilyMember', required: true },
  otherMember: { type: mongoose.Schema.Types.ObjectId, ref: 'FamilyMember', default: null },
  kind: { type: String, enum: ['rent', 'spend', 'transfer', 'opening', 'deposit'], required: true },
  amount: { type: Number, required: true },
  note: { type: String, default: '' },
  payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
  date: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('FamilyTransaction', FamilyTransactionSchema);
