const mongoose = require('mongoose');

// Singleton settings document — only one record is ever kept
const SettingsSchema = new mongoose.Schema({
  propertyName: { type: String, default: 'Warehouse Rental' }
}, { timestamps: true });

module.exports = mongoose.model('Settings', SettingsSchema);
