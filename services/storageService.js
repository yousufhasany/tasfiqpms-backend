const cloudinary = require('../config/cloudinary');

exports.uploadFile = async (file, folder = 'tasfiq') => {
  // Store file directly in MongoDB as binary data
  return {
    data: file.buffer,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    uploadedAt: new Date()
  };
};

exports.deleteFile = async (publicId) => {
  // MongoDB stores files as binary data, no external cleanup needed
  return;
};

exports.saveDocumentRecord = async (Document, { tenant, property, type, fileMeta }) => {
  return Document.create({
    tenant: tenant || null,
    property: property || null,
    type,
    file: fileMeta
  });
};
