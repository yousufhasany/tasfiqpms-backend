const Document = require('../models/Document');
const Tenant = require('../models/Tenant');

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

exports.getNIDDocument = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.tenantId);
    if (!tenant || !tenant.nidDocument) {
      return res.status(404).json({ msg: 'Document not found' });
    }

    res.setHeader('Content-Type', tenant.nidDocument.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${tenant.nidDocument.originalName || 'nid.pdf'}"`);
    res.send(tenant.nidDocument.data);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.downloadDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document || !document.file || !document.file.data) {
      return res.status(404).json({ msg: 'Document not found' });
    }

    res.setHeader('Content-Type', document.file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${document.file.originalName || 'document'}"`);
    res.send(document.file.data);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};
