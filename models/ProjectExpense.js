const mongoose = require('mongoose');
const FileMetaSchema = require('./schemas/fileMeta');

const ProjectExpenseSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'OfficeProject', required: true },
  manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  expenseDate: { type: Date, required: true, default: Date.now },
  category: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 1 },
  paymentMethod: { type: String, required: true, trim: true },
  attachment: { type: FileMetaSchema, default: null }
}, { timestamps: true });

module.exports = mongoose.model('ProjectExpense', ProjectExpenseSchema);
