const mongoose = require('mongoose');

const AgreementSchema = new mongoose.Schema({
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  monthlyRent: { type: Number, required: true },
  securityDeposit: { type: Number },
  status: { type: String, enum: ['Active','Expired','Terminated'], default: 'Active' }
}, { timestamps: true });

module.exports = mongoose.model('Agreement', AgreementSchema);
