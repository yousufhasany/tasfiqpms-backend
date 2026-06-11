const mongoose = require('mongoose');

const PropertySchema = new mongoose.Schema({
  propertyName: { type: String, required: true },
  location: { type: String, required: true },
  monthlyRent: { type: Number, required: true },
  status: { type: String, enum: ['Available', 'Rented'], default: 'Available' },
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null },
  rentStartDate: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Property', PropertySchema);
