const FamilyMember = require('../models/FamilyMember');
const FamilyTransaction = require('../models/FamilyTransaction');
const { snapshot, balancesFrom } = require('../services/familyLedger');

function allowed(role) {
  const value = (role || '').toLowerCase();
  return value === 'admin' || value === 'manager';
}

exports.requireFamily = (req, res, next) => {
  if (!allowed(req.userRole)) {
    return res.status(403).json({ msg: 'Access denied' });
  }
  next();
};

exports.getDashboard = async (req, res) => {
  try {
    res.json(await snapshot());
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.getMember = async (req, res) => {
  try {
    const member = await FamilyMember.findById(req.params.id);
    if (!member) return res.status(404).json({ msg: 'Family member not found' });

    const [members, allTransactions, transactions] = await Promise.all([
      FamilyMember.find(),
      FamilyTransaction.find(),
      FamilyTransaction.find({
        $or: [{ member: member._id }, { otherMember: member._id }]
      }).sort({ date: -1, createdAt: -1 }).populate('member otherMember', 'name')
    ]);
    const totals = balancesFrom(members, allTransactions);
    res.json({
      member: {
        _id: member._id,
        name: member.name,
        receivesRent: member.receivesRent,
        balance: totals[String(member._id)] || 0
      },
      transactions
    });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.deleteMember = async (req, res) => {
  try {
    if (!onlyAdmin(req, res)) return;
    const member = await FamilyMember.findById(req.params.id);
    if (!member) return res.status(404).json({ msg: 'Family member not found' });

    const remaining = await FamilyMember.countDocuments({ _id: { $ne: member._id } });
    if (remaining === 0) {
      return res.status(400).json({ msg: 'Keep at least one family member' });
    }

    if (member.receivesRent) {
      const next = await FamilyMember.findOne({ _id: { $ne: member._id } }).sort({ createdAt: 1 });
      next.receivesRent = true;
      await next.save();
      await FamilyTransaction.updateMany(
        { member: member._id, kind: 'rent' },
        { member: next._id }
      );
    }

    await FamilyTransaction.deleteMany({
      $or: [
        { member: member._id, kind: { $ne: 'rent' } },
        { otherMember: member._id }
      ]
    });
    await member.deleteOne();
    res.json(await snapshot());
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

exports.addMember = async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ msg: 'Family member name is required' });

    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existing = await FamilyMember.findOne({ name: new RegExp(`^${escaped}$`, 'i') });
    if (existing) return res.status(400).json({ msg: 'That family member is already added' });

    const count = await FamilyMember.countDocuments();
    const member = await FamilyMember.create({
      name,
      receivesRent: count === 0 || req.body.receivesRent === true
    });

    if (member.receivesRent) {
      await FamilyMember.updateMany({ _id: { $ne: member._id } }, { receivesRent: false });
    }

    const starting = Number(req.body.amount);
    if (starting > 0) {
      await FamilyTransaction.create({
        member: member._id,
        kind: 'opening',
        amount: starting,
        note: 'Starting money',
        date: new Date()
      });
    }

    res.status(201).json(await snapshot());
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

async function memberBalance(memberId) {
  const members = await FamilyMember.find();
  const transactions = await FamilyTransaction.find();
  const totals = balancesFrom(members, transactions);
  return totals[String(memberId)] || 0;
}

function onlyAdmin(req, res) {
  if ((req.userRole || '').toLowerCase() !== 'admin') {
    res.status(403).json({ msg: 'Only admin can change family records' });
    return false;
  }
  return true;
}

exports.updateTransaction = async (req, res) => {
  try {
    if (!onlyAdmin(req, res)) return;
    const txn = await FamilyTransaction.findById(req.params.id);
    if (!txn) return res.status(404).json({ msg: 'Movement not found' });

    const amount = Number(req.body.amount);
    if (!amount || amount <= 0) return res.status(400).json({ msg: 'Enter an amount' });
    txn.amount = amount;
    if (req.body.note !== undefined) txn.note = String(req.body.note || '').trim();

    if (txn.kind !== 'rent' && req.body.memberId) {
      const member = await FamilyMember.findById(req.body.memberId);
      if (!member) return res.status(404).json({ msg: 'Family member not found' });
      txn.member = member._id;
    }

    if (txn.kind === 'transfer') {
      if (!req.body.toId) return res.status(400).json({ msg: 'Choose who received the money' });
      if (String(req.body.toId) === String(txn.member)) {
        return res.status(400).json({ msg: 'Choose a different family member' });
      }
      const to = await FamilyMember.findById(req.body.toId);
      if (!to) return res.status(404).json({ msg: 'Family member not found' });
      txn.otherMember = to._id;
    }

    await txn.save();
    res.json(await snapshot());
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

exports.deleteTransaction = async (req, res) => {
  try {
    if (!onlyAdmin(req, res)) return;
    const txn = await FamilyTransaction.findById(req.params.id);
    if (!txn) return res.status(404).json({ msg: 'Movement not found' });
    await txn.deleteOne();
    res.json(await snapshot());
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

exports.deposit = async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    if (!req.body.memberId) return res.status(400).json({ msg: 'Choose a family member' });
    if (!amount || amount <= 0) return res.status(400).json({ msg: 'Enter an amount' });

    const member = await FamilyMember.findById(req.body.memberId);
    if (!member) return res.status(404).json({ msg: 'Family member not found' });

    await FamilyTransaction.create({
      member: member._id,
      kind: 'deposit',
      amount,
      note: (req.body.note || '').trim() || 'Deposit',
      date: new Date()
    });

    res.status(201).json(await snapshot());
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

exports.spend = async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    const note = (req.body.note || '').trim();
    if (!req.body.memberId) return res.status(400).json({ msg: 'Choose who spent the money' });
    if (!amount || amount <= 0) return res.status(400).json({ msg: 'Enter an amount' });

    const member = await FamilyMember.findById(req.body.memberId);
    if (!member) return res.status(404).json({ msg: 'Family member not found' });

    const balance = await memberBalance(member._id);
    if (amount > balance) {
      return res.status(400).json({ msg: `${member.name} does not have enough money` });
    }

    await FamilyTransaction.create({
      member: member._id,
      kind: 'spend',
      amount,
      note: note || 'Spent',
      date: new Date()
    });

    res.status(201).json(await snapshot());
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

exports.transfer = async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    const note = (req.body.note || '').trim();
    if (!req.body.fromId || !req.body.toId) return res.status(400).json({ msg: 'Choose both family members' });
    if (String(req.body.fromId) === String(req.body.toId)) {
      return res.status(400).json({ msg: 'Choose a different family member' });
    }
    if (!amount || amount <= 0) return res.status(400).json({ msg: 'Enter an amount' });

    const [from, to] = await Promise.all([
      FamilyMember.findById(req.body.fromId),
      FamilyMember.findById(req.body.toId)
    ]);
    if (!from || !to) return res.status(404).json({ msg: 'Family member not found' });

    const balance = await memberBalance(from._id);
    if (amount > balance) {
      return res.status(400).json({ msg: `${from.name} does not have enough money` });
    }

    await FamilyTransaction.create({
      member: from._id,
      otherMember: to._id,
      kind: 'transfer',
      amount,
      note: note || `Sent to ${to.name}`,
      date: new Date()
    });

    res.status(201).json(await snapshot());
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};
