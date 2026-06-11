const mongoose = require('mongoose');

const FileMetaSchema = new mongoose.Schema({
  data: { type: Buffer, required: true },
  originalName: { type: String },
  mimeType: { type: String },
  size: { type: Number },
  uploadedAt: { type: Date, default: Date.now }
}, { _id: true });

module.exports = FileMetaSchema;
