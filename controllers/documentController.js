const Document = require('../models/Document');

exports.getDocuments = async (req, res) => {
  try {
    const filter = {};
    if (req.query.tenant) filter.tenant = req.query.tenant;
    if (req.query.property) filter.property = req.query.property;
    if (req.query.type) filter.type = req.query.type;

    const documents = await Document.find(filter)
      .populate('tenant property')
      .sort({ createdAt: -1 });
    res.json(documents);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};
