const cloudinary = require('../config/cloudinary');

function requireCloudinary() {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary credentials are not configured');
  }
}

exports.uploadFile = async (file, folder = 'tasfiq') => {
  requireCloudinary();

  const b64 = file.buffer.toString('base64');
  const dataUri = `data:${file.mimetype};base64,${b64}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type: 'raw'
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    uploadedAt: new Date()
  };
};

exports.deleteFile = async (publicId) => {
  if (!publicId) return;
  requireCloudinary();
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
  } catch (err) {
    console.error('Cloudinary delete failed:', err.message);
  }
};

exports.saveDocumentRecord = async (Document, { tenant, property, type, fileMeta }) => {
  return Document.create({
    tenant: tenant || null,
    property: property || null,
    type,
    file: fileMeta
  });
};
