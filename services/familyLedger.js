const FamilyMember = require('../models/FamilyMember');
const FamilyTransaction = require('../models/FamilyTransaction');

async function rentAccount() {
  let member = await FamilyMember.findOne({ receivesRent: true });
  if (member) return member;

  member = await FamilyMember.findOne().sort({ createdAt: 1 });
  if (!member) {
    return FamilyMember.create({ name: 'Yeasin Miah', receivesRent: true });
  }

  member.receivesRent = true;
  await member.save();
  return member;
}

async function ensureMembers() {
  const count = await FamilyMember.countDocuments();
  if (count === 0) {
    await FamilyMember.create({ name: 'Yeasin Miah', receivesRent: true });
  }
}

function balancesFrom(members, transactions) {
  const totals = {};
  members.forEach(member => { totals[String(member._id)] = 0; });

  transactions.forEach(txn => {
    const amount = Number(txn.amount || 0);
    const memberId = String(txn.member);
    const otherId = txn.otherMember ? String(txn.otherMember) : null;
    if (txn.kind === 'rent' || txn.kind === 'opening' || txn.kind === 'deposit') totals[memberId] = (totals[memberId] || 0) + amount;
    if (txn.kind === 'spend') totals[memberId] = (totals[memberId] || 0) - amount;
    if (txn.kind === 'transfer') {
      totals[memberId] = (totals[memberId] || 0) - amount;
      if (otherId) totals[otherId] = (totals[otherId] || 0) + amount;
    }
  });

  return totals;
}

async function snapshot() {
  await ensureMembers();
  const [members, transactions] = await Promise.all([
    FamilyMember.find().sort({ createdAt: 1 }),
    FamilyTransaction.find().sort({ date: -1, createdAt: -1 }).limit(40)
      .populate('member otherMember', 'name')
  ]);
  const totals = balancesFrom(members, await FamilyTransaction.find());
  const listed = members.map(member => ({
    _id: member._id,
    name: member.name,
    receivesRent: member.receivesRent,
    balance: totals[String(member._id)] || 0
  }));
  const total = listed.reduce((sum, member) => sum + member.balance, 0);
  return { total, members: listed, transactions };
}

async function syncRentPayment(payment) {
  if (!payment) return;
  const member = await rentAccount();
  let note = 'Rent collected';
  const propertyId = payment.property && payment.property._id ? payment.property._id : payment.property;
  if (propertyId) {
    const Property = require('../models/Property');
    const prop = await Property.findById(propertyId).select('propertyName');
    if (prop?.propertyName) note = `Rent collected · ${prop.propertyName}`;
  }
  await FamilyTransaction.findOneAndUpdate(
    { payment: payment._id, kind: 'rent' },
    {
      member: member._id,
      kind: 'rent',
      amount: Number(payment.amount || 0),
      note,
      payment: payment._id,
      date: payment.paymentDate || new Date()
    },
    { upsert: true }
  );
}

async function removeRentPayment(paymentId) {
  if (!paymentId) return;
  await FamilyTransaction.deleteMany({ payment: paymentId, kind: 'rent' });
}

module.exports = {
  snapshot,
  syncRentPayment,
  removeRentPayment,
  balancesFrom
};
