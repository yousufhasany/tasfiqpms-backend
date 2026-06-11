const mongoose = require('mongoose');
const FileMetaSchema = require('./schemas/fileMeta');

const DocumentSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' },
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
  type: { type: String, enum: ['nid', 'other'], default: 'other' },
  file: { type: FileMetaSchema, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Document', DocumentSchema);
