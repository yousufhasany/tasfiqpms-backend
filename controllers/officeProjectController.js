const OfficeProject = require('../models/OfficeProject');
const OfficeTransaction = require('../models/OfficeTransaction');
const BankTransaction = require('../models/BankTransaction');

// GET /api/office-projects
exports.getAll = async (req, res) => {
  try {
    const projects = await OfficeProject.find()
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    const projectIds = projects.map(p => p._id);
    
    // Aggregate office transactions
    const officeSummaries = await OfficeTransaction.aggregate([
      { $match: { project: { $in: projectIds } } },
      {
        $group: {
          _id: '$project',
          totalDebit: { $sum: '$debit' },
          totalCredit: { $sum: '$credit' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Aggregate bank transactions
    const bankSummaries = await BankTransaction.aggregate([
      { $match: { project: { $in: projectIds } } },
      {
        $group: {
          _id: '$project',
          totalDebit: { $sum: '$debit' },
          totalCredit: { $sum: '$credit' },
          count: { $sum: 1 }
        }
      }
    ]);

    const officeMap = {};
    officeSummaries.forEach(s => { officeMap[s._id.toString()] = s; });

    const bankMap = {};
    bankSummaries.forEach(s => { bankMap[s._id.toString()] = s; });

    const result = projects.map(p => {
      const o = officeMap[p._id.toString()] || { totalDebit: 0, totalCredit: 0, count: 0 };
      const b = bankMap[p._id.toString()] || { totalDebit: 0, totalCredit: 0, count: 0 };
      return {
        ...p.toObject(),
        totalDebit: o.totalDebit,
        totalCredit: o.totalCredit,
        netBalance: o.totalCredit - o.totalDebit,
        transactionCount: o.count,
        bankTotalDebit: b.totalDebit,
        bankTotalCredit: b.totalCredit,
        bankNetBalance: b.totalCredit - b.totalDebit,
        bankTransactionCount: b.count
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// GET /api/office-projects/:id
exports.getOne = async (req, res) => {
  try {
    const project = await OfficeProject.findById(req.params.id)
      .populate('createdBy', 'name email');
    if (!project) return res.status(404).json({ msg: 'Project not found' });
    res.json(project);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// POST /api/office-projects
exports.create = async (req, res) => {
  try {
    const { name, description, status } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ msg: 'Project name is required' });

    const project = await OfficeProject.create({
      name: name.trim(),
      description: description || '',
      status: status || 'active',
      createdBy: req.userId || null
    });

    const populated = await OfficeProject.findById(project._id).populate('createdBy', 'name email');
    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

// PUT /api/office-projects/:id
exports.update = async (req, res) => {
  try {
    const { name, description, status } = req.body;
    const project = await OfficeProject.findById(req.params.id);
    if (!project) return res.status(404).json({ msg: 'Project not found' });

    if (name !== undefined) project.name = name.trim();
    if (description !== undefined) project.description = description;
    if (status !== undefined) project.status = status;

    await project.save();
    const populated = await OfficeProject.findById(project._id).populate('createdBy', 'name email');
    res.json(populated);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

// DELETE /api/office-projects/:id  (admin only — cascades to transactions)
exports.remove = async (req, res) => {
  try {
    const project = await OfficeProject.findById(req.params.id);
    if (!project) return res.status(404).json({ msg: 'Project not found' });

    // Delete all transactions under this project
    await OfficeTransaction.deleteMany({ project: project._id });
    await BankTransaction.deleteMany({ project: project._id });
    await project.deleteOne();

    res.json({ msg: 'Project and all its transactions deleted' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};
