const mongoose = require('mongoose');

const ProjectUpdateSchema = new mongoose.Schema({
  description: { type: String, required: true },
  progress: { type: Number, min: 0, max: 100, default: 0 },
  date: { type: Date, default: Date.now },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

const OfficeProjectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  startDate: { type: Date, default: Date.now },
  status: { type: String, enum: ['active', 'closed'], default: 'active' },
  manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  progress: { type: Number, min: 0, max: 100, default: 0 },
  updates: [ProjectUpdateSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('OfficeProject', OfficeProjectSchema);
