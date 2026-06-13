const mongoose = require('mongoose');

const OfficeProjectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  status: { type: String, enum: ['active', 'closed'], default: 'active' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('OfficeProject', OfficeProjectSchema);
