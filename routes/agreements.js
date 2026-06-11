const express = require('express');
const router = express.Router();
const Agreement = require('../models/Agreement');
const Property = require('../models/Property');
const auth = require('../middleware/auth');

// GET /api/agreements
router.get('/', async (req, res) => {
  try {
    const ag = await Agreement.find().populate('property tenant').sort({ createdAt: -1 });
    res.json(ag);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// POST /api/agreements
router.post('/', auth, async (req, res) => {
  try {
    const a = new Agreement(req.body);
    await a.save();
    // update property status to Rented
    await Property.findByIdAndUpdate(a.property, { status: 'Rented' });
    res.status(201).json(a);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
});

module.exports = router;
