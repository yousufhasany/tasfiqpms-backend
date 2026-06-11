const express = require('express');
const router = express.Router();
const upload = require('../config/multer');
const Property = require('../models/Property');
const Tenant = require('../models/Tenant');
const auth = require('../middleware/auth');

// POST /api/uploads/property/:id (images)
router.post('/property/:id', auth, upload.array('images', 10), async (req, res) => {
  try {
    const files = req.files.map(f => `/uploads/${f.filename}`);
    const p = await Property.findById(req.params.id);
    if (!p) return res.status(404).json({ msg: 'Property not found' });
    p.images = p.images.concat(files);
    await p.save();
    res.json(p);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// POST /api/uploads/tenant/:id (documents)
router.post('/tenant/:id', auth, upload.array('documents', 10), async (req, res) => {
  try {
    const files = req.files.map(f => `/uploads/${f.filename}`);
    const t = await Tenant.findById(req.params.id);
    if (!t) return res.status(404).json({ msg: 'Tenant not found' });
    t.documents = t.documents.concat(files);
    await t.save();
    res.json(t);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
