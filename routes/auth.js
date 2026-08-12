const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!email || !password) return res.status(400).json({ msg: 'Please provide email and password' });
  try {
    let user = await User.findOne({ 
      $or: [
        { email: { $regex: new RegExp(`^${email}$`, 'i') } },
        { username: { $regex: new RegExp(`^${email}$`, 'i') } }
      ]
    });
    if (user) return res.status(400).json({ msg: 'User already exists' });

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    const normalizedRole = (role || '').toLowerCase();
    if (normalizedRole === 'admin' || normalizedRole === 'admin2') {
      return res.status(400).json({ msg: 'Creating additional Admin/Admin2 accounts is not allowed.' });
    }

    // Only allow valid roles; default to 'manager' if not specified
    const allowedRoles = ['office', 'manager', 'finance_manager'];
    const assignedRole = allowedRoles.includes(normalizedRole) ? normalizedRole : 'manager';

    user = new User({ name, email, username: email, password: hashed, role: assignedRole });
    await user.save();

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || 'changeme',
      { expiresIn: '7d' }
    );
    res.json({ token, role: user.role });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ msg: 'Please provide email and password' });
  try {
    const user = await User.findOne({
      $or: [
        { email: { $regex: new RegExp(`^${email}$`, 'i') } },
        { username: { $regex: new RegExp(`^${email}$`, 'i') } }
      ]
    });
    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });

    if (user.status === 'disabled') {
      return res.status(403).json({ msg: 'Your account has been disabled. Please contact the administrator.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

    // Embed role in JWT for fast, DB-free role checks
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || 'changeme',
      { expiresIn: '7d' }
    );
    res.json({ token, role: user.role });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) return res.status(404).json({ msg: 'User not found' });
    if (user.status === 'disabled') {
      return res.status(403).json({ msg: 'Account disabled' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
