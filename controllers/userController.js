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

// Get all users
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// Update user password
exports.updateUserPassword = async (req, res) => {
  const { password } = req.body;
  if (!password || password.trim().length < 6) {
    return res.status(400).json({ msg: 'Password must be at least 6 characters long' });
  }

  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    await user.save();

    res.json({ msg: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// Update user status
exports.updateUserStatus = async (req, res) => {
  const { status } = req.body;
  if (!status || !['active', 'disabled'].includes(status)) {
    return res.status(400).json({ msg: 'Invalid status value' });
  }

  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    // Protect main admin
    if (user.email === 'tasfiqalam121@gmail.com') {
      return res.status(400).json({ msg: 'Main Admin account status cannot be modified' });
    }

    user.status = status;
    await user.save();

    res.json({ msg: `User account is now ${status}`, user: { _id: user._id, status: user.status } });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// Update user role
exports.updateUserRole = async (req, res) => {
  const { role } = req.body;

  // Protect against changing own role
  if (req.params.id === req.userId) {
    return res.status(400).json({ msg: 'You are not allowed to change your own role.' });
  }

  // Protect against assigning Admin/Admin2 roles
  const normalizedRole = (role || '').toLowerCase();
  if (normalizedRole === 'admin' || normalizedRole === 'admin2') {
    return res.status(400).json({ msg: 'Creating additional Admin/Admin2 accounts is not allowed.' });
  }

  const allowedRoles = ['admin', 'office', 'manager', 'finance_manager', 'Admin', 'Manager', 'Admin2'];
  if (!role || !allowedRoles.includes(role)) {
    return res.status(400).json({ msg: 'Invalid role value' });
  }

  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    // Protect main admin
    if (user.email === 'tasfiqalam121@gmail.com' || user.username === 'Alam') {
      return res.status(400).json({ msg: 'Main Admin account role cannot be demoted' });
    }

    user.role = role;
    await user.save();

    res.json({ msg: 'User role updated successfully', user: { _id: user._id, role: user.role } });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    // Protect main admin
    if (user.email === 'tasfiqalam121@gmail.com') {
      return res.status(400).json({ msg: 'Main Admin account cannot be deleted' });
    }

    // Cascade: if role is manager, unassign from projects
    if (user.role === 'manager') {
      await OfficeProject.updateMany({ manager: user._id }, { $set: { manager: null } });
    }

    await user.deleteOne();
    res.json({ msg: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};
