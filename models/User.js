const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String },
  username: { type: String, unique: true, sparse: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['Admin', 'Manager', 'Admin2', 'admin', 'office', 'manager', 'finance_manager'], default: 'admin' },
  status: { type: String, enum: ['active', 'disabled'], default: 'active' }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
