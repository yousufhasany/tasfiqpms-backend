const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  amount: { type: Number, required: true },
  paymentDate: { type: Date, default: Date.now },
  rentMonth: { type: String, default: () => new Date().toISOString().slice(0, 7) },
  notes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Payment', PaymentSchema);
