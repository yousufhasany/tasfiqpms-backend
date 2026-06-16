const mongoose = require('mongoose');

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error('MONGO_URI must be set to your MongoDB Atlas connection string');
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      bufferCommands: false
    }).then(async (mongooseInstance) => {
      console.log('MongoDB Atlas connected');
      try {
        // Load the User model to ensure its schema is compiled and registered
        const User = require('../models/User');
        const bcrypt = require('bcryptjs');
        const adminEmail = 'tasfiqalam121@gmail.com';
        const adminPass = 'tasfiqalam121';

        let admin = await User.findOne({ email: adminEmail });
        if (!admin) {
          const salt = await bcrypt.genSalt(10);
          const hashed = await bcrypt.hash(adminPass, salt);
          admin = new User({
            name: 'Tasfiq Admin',
            email: adminEmail,
            password: hashed,
            role: 'admin'
          });
          await admin.save();
          console.log('Seeded Admin user: tasfiqalam121@gmail.com');
        }

        const deleteRes = await User.deleteMany({ role: 'admin', email: { $ne: adminEmail } });
        if (deleteRes.deletedCount > 0) {
          console.log(`Deleted ${deleteRes.deletedCount} duplicate/legacy admin accounts.`);
        }
      } catch (err) {
        console.error('Error seeding admin user:', err.message);
      }
      return mongooseInstance;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
};

module.exports = connectDB;
