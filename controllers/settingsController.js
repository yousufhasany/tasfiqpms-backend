const Settings = require('../models/Settings');

// GET /api/settings
exports.getSettings = async (req, res) => {
  try {
    // findOne or create the singleton
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({ propertyName: 'Warehouse Rental' });
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// PUT /api/settings
exports.updateSettings = async (req, res) => {
  try {
    const { propertyName } = req.body;
    if (!propertyName || !propertyName.trim()) {
      return res.status(400).json({ msg: 'Property name is required' });
    }

    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({ propertyName: propertyName.trim() });
    } else {
      settings.propertyName = propertyName.trim();
      await settings.save();
    }

    res.json(settings);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};
