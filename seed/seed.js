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

  const existingUser = await User.findOne({ email: 'admin@tasfiq.com' });
  if (!existingUser) {
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash('admin123', salt);
    await User.create({ name: 'Admin', email: 'admin@tasfiq.com', password: hashed });
    console.log('Admin user: admin@tasfiq.com / admin123');
  }

  console.log('Seed complete');
  process.exit(0);
};

seed().catch(err => { console.error(err); process.exit(1); });
