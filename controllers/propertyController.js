const Property = require('../models/Property');
const Tenant = require('../models/Tenant');
const Payment = require('../models/Payment');
const Document = require('../models/Document');
const { uploadFile, deleteFile, saveDocumentRecord } = require('../services/storageService');

const PAYMENT_SORT = { paymentDate: -1, createdAt: -1 };

exports.getProperties = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const properties = await Property.find(filter)
      .populate('tenant')
      .sort({ createdAt: -1 });
    res.json(properties);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.getProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id).populate('tenant');
    if (!property) return res.status(404).json({ msg: 'Property not found' });

    const payments = await Payment.find({ property: property._id })
      .populate('tenant')
      .sort(PAYMENT_SORT);

    res.json({ property, payments });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.createProperty = async (req, res) => {
  try {
    console.log('\n=== CREATE PROPERTY REQUEST ===');
    console.log('Body received:', JSON.stringify(req.body));
    console.log('User ID:', req.userId);
    
    const { propertyName, location, monthlyRent } = req.body;
    
    if (!propertyName || !location || !monthlyRent) {
      console.log('VALIDATION FAILED - Missing fields:', { propertyName, location, monthlyRent });
      return res.status(400).json({ msg: 'Missing required fields' });
    }
    
    console.log('Creating property with:', { propertyName, location, monthlyRent: Number(monthlyRent) });
    
    const property = await Property.create({
      propertyName,
      location,
      monthlyRent: Number(monthlyRent),
      status: 'Available'
    });
    
    console.log('SUCCESS - Property created:', { id: property._id, name: property.propertyName });
    console.log('=== END CREATE PROPERTY ===\n');
    
    res.status(201).json(property);
  } catch (err) {
    console.error('ERROR - Failed to create property:', err.message);
    console.log('Full error:', err);
    console.log('=== END CREATE PROPERTY (ERROR) ===\n');
    res.status(500).json({ msg: err.message });
  }
};

exports.updateProperty = async (req, res) => {
  try {
    const { propertyName, location, monthlyRent } = req.body;
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ msg: 'Property not found' });

    if (propertyName !== undefined) property.propertyName = propertyName;
    if (location !== undefined) property.location = location;
    if (monthlyRent !== undefined) property.monthlyRent = Number(monthlyRent);

    await property.save();
    res.json(property);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

exports.updateRentPrice = async (req, res) => {
  try {
    const { monthlyRent } = req.body;
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ msg: 'Property not found' });

    property.monthlyRent = Number(monthlyRent);
    await property.save();
    res.json(property);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

exports.updateRentStartDate = async (req, res) => {
  try {
    const { rentStartDate } = req.body;
    if (!rentStartDate) return res.status(400).json({ msg: 'Rent start date is required' });

    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ msg: 'Property not found' });
    if (property.status !== 'Rented') {
      return res.status(400).json({ msg: 'Can only update rent start date for rented properties' });
    }

    property.rentStartDate = new Date(rentStartDate);
    await property.save();

    const populated = await Property.findById(property._id).populate('tenant');
    res.json(populated);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

exports.rentProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ msg: 'Property not found' });
    if (property.status === 'Rented') {
      return res.status(400).json({ msg: 'Property is already rented' });
    }

    const { tenantName, address, mobile, rentStartDate } = req.body;
    if (!tenantName || !address || !mobile || !rentStartDate) {
      return res.status(400).json({ msg: 'All tenant fields are required' });
    }

    let nidDocument = null;
    if (req.file) {
      nidDocument = await uploadFile(req.file, 'tasfiq/nid');
    }

    const tenant = await Tenant.create({
      name: tenantName,
      address,
      mobile,
      nidDocument,
      property: property._id
    });

    if (nidDocument) {
      await saveDocumentRecord(Document, {
        tenant: tenant._id,
        property: property._id,
        type: 'nid',
        fileMeta: nidDocument
      });
    }

    property.status = 'Rented';
    property.tenant = tenant._id;
    property.rentStartDate = new Date(rentStartDate);
    await property.save();

    const populated = await Property.findById(property._id).populate('tenant');
    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

exports.deleteProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ msg: 'Property not found' });

    if (property.tenant) {
      const tenant = await Tenant.findById(property.tenant);
      if (tenant) {
        // Files are stored in MongoDB, no need to delete from Cloudinary
        await Document.deleteMany({ tenant: tenant._id });
        await tenant.deleteOne();
      }
      await Payment.deleteMany({ property: property._id });
    }

    await property.deleteOne();
    res.json({ msg: 'Property deleted' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};
