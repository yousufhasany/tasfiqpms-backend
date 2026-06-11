const mongoose = require('mongoose');
const FileMetaSchema = require('./schemas/fileMeta');

const TenantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: { type: String, required: true },
  mobile: { type: String, required: true },
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  nidDocument: { type: FileMetaSchema, default: null },
  documents: [FileMetaSchema]
}, { timestamps: true });

module.exports = mongoose.model('Tenant', TenantSchema);
