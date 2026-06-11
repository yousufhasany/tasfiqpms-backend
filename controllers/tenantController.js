const Tenant = require('../models/Tenant');
const Property = require('../models/Property');
const Payment = require('../models/Payment');
const Document = require('../models/Document');
const { uploadFile, deleteFile, saveDocumentRecord } = require('../services/storageService');

const PAYMENT_SORT = { paymentDate: -1, createdAt: -1 };

exports.getTenants = async (req, res) => {
  try {
    const tenants = await Tenant.find().populate('property').sort({ createdAt: -1 });
    res.json(tenants);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.getTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id).populate('property');
    if (!tenant) return res.status(404).json({ msg: 'Tenant not found' });

    const payments = await Payment.find({ tenant: tenant._id })
      .populate('property')
      .sort(PAYMENT_SORT);

    const documents = await Document.find({ tenant: tenant._id }).sort({ createdAt: -1 });

    res.json({ tenant, payments, documents });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.updateTenant = async (req, res) => {
  try {
    const { name, address, mobile } = req.body;
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) return res.status(404).json({ msg: 'Tenant not found' });

    if (name !== undefined) tenant.name = name;
    if (address !== undefined) tenant.address = address;
    if (mobile !== undefined) tenant.mobile = mobile;

    if (req.file) {
      if (tenant.nidDocument?.publicId) await deleteFile(tenant.nidDocument.publicId);
      const fileMeta = await uploadFile(req.file, 'tasfiq/nid');
      tenant.nidDocument = fileMeta;
      await saveDocumentRecord(Document, {
        tenant: tenant._id,
        property: tenant.property,
        type: 'nid',
        fileMeta
      });
    }

    await tenant.save();
    const populated = await Tenant.findById(tenant._id).populate('property');
    res.json(populated);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

exports.uploadDocument = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) return res.status(404).json({ msg: 'Tenant not found' });
    if (!req.file) return res.status(400).json({ msg: 'PDF file is required' });

    const fileMeta = await uploadFile(req.file, 'tasfiq/documents');
    tenant.documents.push(fileMeta);
    await tenant.save();

    const docRecord = await saveDocumentRecord(Document, {
      tenant: tenant._id,
      property: tenant.property,
      type: 'other',
      fileMeta
    });

    res.status(201).json({ tenant, document: docRecord });
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

exports.deleteTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) return res.status(404).json({ msg: 'Tenant not found' });

    if (tenant.nidDocument?.publicId) await deleteFile(tenant.nidDocument.publicId);
    for (const doc of tenant.documents || []) {
      if (doc.publicId) await deleteFile(doc.publicId);
    }
    await Document.deleteMany({ tenant: tenant._id });

    await Property.findByIdAndUpdate(tenant.property, {
      status: 'Available',
      tenant: null,
      rentStartDate: null
    });

    await Payment.deleteMany({ tenant: tenant._id });
    await tenant.deleteOne();
    res.json({ msg: 'Tenant removed and property marked available' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};
