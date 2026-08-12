const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('../config/db');
const Property = require('../models/Property');
const Tenant = require('../models/Tenant');
const Payment = require('../models/Payment');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

dotenv.config();

const seed = async () => {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is required. Set it to your MongoDB Atlas connection string.');
    process.exit(1);
  }

  await connectDB();
  await Payment.deleteMany();
  await Tenant.deleteMany();
  await Property.deleteMany();

  const p1 = await Property.create({
    propertyName: 'Shop A - Gulshan',
    location: 'Gulshan-1, Dhaka',
    monthlyRent: 15000,
    status: 'Available'
  });

  const p2 = await Property.create({
    propertyName: 'Flat B - Dhanmondi',
    location: 'Dhanmondi 27, Dhaka',
    monthlyRent: 25000,
    status: 'Available'
  });

  const p3 = await Property.create({
    propertyName: 'Office C - Banani',
    location: 'Banani, Dhaka',
    monthlyRent: 35000,
    status: 'Rented',
    rentStartDate: new Date('2026-01-01')
  });

  const t1 = await Tenant.create({
    name: 'Karim Ahmed',
    address: 'Mirpur-10, Dhaka',
    mobile: '01712345678',
    property: p3._id
  });

  p3.tenant = t1._id;
  await p3.save();

  await Payment.create({
    property: p3._id,
    tenant: t1._id,
    amount: 35000,
    paymentDate: new Date('2026-06-01'),
    notes: 'June rent'
  });

  await Payment.create({
    property: p3._id,
    tenant: t1._id,
    amount: 35000,
    paymentDate: new Date('2026-05-01'),
    notes: 'May rent'
  });

  const existingUser = await User.findOne({ email: 'tasfiqalam121@gmail.com' });
  if (!existingUser) {
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash('tasfiqalam121', salt);
    await User.create({ name: 'Admin', username: 'tasfiqalam121', email: 'tasfiqalam121@gmail.com', password: hashed, role: 'admin' });
    console.log('Admin user: tasfiqalam121@gmail.com / tasfiqalam121');
  }
  await User.deleteMany({ role: 'admin', email: { $ne: 'tasfiqalam121@gmail.com' } });

  // Seed the 3 requested accounts
  const seedUsers = [
    { name: 'Alam', username: 'Alam', email: 'alam@example.com', password: 'Am@2026', role: 'Admin' },
    { name: 'Yeasinmia24', username: 'Yeasinmia24', email: 'yeasinmia24@example.com', password: '01626757272@Y', role: 'Manager' },
    { name: 'Sihab', username: 'Sihab', email: 'sihab@example.com', password: 'greenpac@2026', role: 'Admin2' }
  ];

  for (const u of seedUsers) {
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(u.password, salt);
    
    await User.findOneAndUpdate(
      { username: u.username },
      {
        name: u.name,
        email: u.email,
        password: hashed,
        role: u.role,
        status: 'active'
      },
      { upsert: true, new: true }
    );
    console.log(`Seeded/Updated user: ${u.username} with role: ${u.role}`);
  }

  console.log('Seed complete');
  process.exit(0);
};

seed().catch(err => { console.error(err); process.exit(1); });
