const OfficeTransaction = require('../models/OfficeTransaction');

/**
 * Recalculate running balance for all transactions in a specific project
 * from the given date onward. Balance is scoped per-project.
 */
async function recalculateBalances(projectId, startFromDate = null) {
  const baseFilter = { project: projectId };
  const filter = startFromDate
    ? { ...baseFilter, date: { $gte: startFromDate } }
    : baseFilter;

  // Find the transaction just before startFromDate (within same project) to get opening balance
  let openingBalance = 0;
  if (startFromDate) {
    const prev = await OfficeTransaction.findOne({
      project: projectId,
      date: { $lt: startFromDate }
    }).sort({ date: -1, createdAt: -1 });
    openingBalance = prev?.balance ?? 0;
  }

  // Get all affected transactions chronologically
  const txns = await OfficeTransaction.find(filter).sort({ date: 1, createdAt: 1 });

  let running = openingBalance;
  for (const txn of txns) {
    running = running + Number(txn.credit || 0) - Number(txn.debit || 0);
    await OfficeTransaction.findByIdAndUpdate(txn._id, { balance: running });
  }
}

// GET /api/office-transactions?project=<id>
exports.getAll = async (req, res) => {
  try {
    const filter = {};
    if (req.query.project) filter.project = req.query.project;

    const transactions = await OfficeTransaction.find(filter)
      .populate('project', 'name status')
      .sort({ date: -1, createdAt: -1 });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// GET /api/office-transactions/summary?project=<id>
exports.getSummary = async (req, res) => {
  try {
    const matchStage = {};
    if (req.query.project) {
      const mongoose = require('mongoose');
      matchStage.project = new mongoose.Types.ObjectId(req.query.project);
    }

    const agg = await OfficeTransaction.aggregate([
      ...(Object.keys(matchStage).length ? [{ $match: matchStage }] : []),
      {
        $group: {
          _id: null,
          totalDebit: { $sum: '$debit' },
          totalCredit: { $sum: '$credit' }
        }
      }
    ]);

    const totalDebit = agg[0]?.totalDebit || 0;
    const totalCredit = agg[0]?.totalCredit || 0;
    const netBalance = totalCredit - totalDebit;

    const latestFilter = req.query.project ? { project: req.query.project } : {};
    const latest = await OfficeTransaction.findOne(latestFilter).sort({ date: -1, createdAt: -1 });

    res.json({ totalDebit, totalCredit, netBalance, currentBalance: latest?.balance ?? 0 });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// POST /api/office-transactions
exports.create = async (req, res) => {
  try {
    const { project, date, details, debit, credit } = req.body;
    if (!project) return res.status(400).json({ msg: 'Project is required' });
    if (!date) return res.status(400).json({ msg: 'Date is required' });

    const txn = await OfficeTransaction.create({
      project,
      date: new Date(date),
      details: details || '',
      debit: Number(debit || 0),
      credit: Number(credit || 0),
      balance: 0,
      createdBy: req.userId || null
    });

    await recalculateBalances(project, txn.date);

    const updated = await OfficeTransaction.findById(txn._id).populate('project', 'name status');
    res.status(201).json(updated);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

// PUT /api/office-transactions/:id
exports.update = async (req, res) => {
  try {
    const { date, details, debit, credit } = req.body;
    const txn = await OfficeTransaction.findById(req.params.id);
    if (!txn) return res.status(404).json({ msg: 'Transaction not found' });

    const oldDate = txn.date;
    const newDate = date ? new Date(date) : txn.date;
    const earliestDate = oldDate < newDate ? oldDate : newDate;

    if (date !== undefined) txn.date = newDate;
    if (details !== undefined) txn.details = details;
    if (debit !== undefined) txn.debit = Number(debit);
    if (credit !== undefined) txn.credit = Number(credit);

    await txn.save();
    await recalculateBalances(txn.project, earliestDate);

    const updated = await OfficeTransaction.findById(txn._id).populate('project', 'name status');
    res.json(updated);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

// DELETE /api/office-transactions/:id
exports.remove = async (req, res) => {
  try {
    const txn = await OfficeTransaction.findById(req.params.id);
    if (!txn) return res.status(404).json({ msg: 'Transaction not found' });

    const { project: projectId, date: deletedDate } = txn;
    await txn.deleteOne();
    await recalculateBalances(projectId, deletedDate);

    res.json({ msg: 'Transaction deleted' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};
