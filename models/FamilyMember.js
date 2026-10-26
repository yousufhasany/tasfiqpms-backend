const mongoose = require('mongoose');

const FamilyMemberSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  receivesRent: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('FamilyMember', FamilyMemberSchema);
