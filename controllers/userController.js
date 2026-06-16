const User = require('../models/User');
const OfficeProject = require('../models/OfficeProject');
const bcrypt = require('bcryptjs');

// Get all managers
exports.getManagers = async (req, res) => {
  try {
    const managers = await User.find({ role: 'manager' }).select('-password').sort({ createdAt: -1 });
    res.json(managers);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// Create a new manager
exports.createManager = async (req, res) => {
  const { name, email, password } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ msg: 'Please provide name, email, and password' });
  }

  try {
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ msg: 'A user with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const manager = new User({
      name,
      email,
      password: hashedPassword,
      role: 'manager'
    });

    await manager.save();

    // Respond without password
    const responseData = manager.toObject();
    delete responseData.password;

    res.status(201).json(responseData);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// Update manager details
exports.updateManager = async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const manager = await User.findById(req.params.id);
    if (!manager || manager.role !== 'manager') {
      return res.status(404).json({ msg: 'Manager not found' });
    }

    // Email update check
    if (email && email !== manager.email) {
      const existing = await User.findOne({ email });
      if (existing) {
        return res.status(400).json({ msg: 'Email is already in use by another account' });
      }
      manager.email = email;
    }

    if (name !== undefined) manager.name = name;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      manager.password = await bcrypt.hash(password, salt);
    }

    await manager.save();

    const responseData = manager.toObject();
    delete responseData.password;
    res.json(responseData);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// Delete a manager and unassign them from projects
exports.deleteManager = async (req, res) => {
  try {
    const manager = await User.findById(req.params.id);
    if (!manager || manager.role !== 'manager') {
      return res.status(404).json({ msg: 'Manager not found' });
    }

    // Unassign this manager from all projects
    await OfficeProject.updateMany({ manager: manager._id }, { $set: { manager: null } });

    await manager.deleteOne();
    res.json({ msg: 'Project Manager deleted successfully' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};
