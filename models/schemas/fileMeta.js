const mongoose = require('mongoose');

const FileMetaSchema = new mongoose.Schema({
  url: { type: String, required: true },
  publicId: { type: String, required: true },
  originalName: { type: String },
  mimeType: { type: String },
  size: { type: Number },
  uploadedAt: { type: Date, default: Date.now }
}, { _id: true });

module.exports = FileMetaSchema;
