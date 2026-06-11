const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');
const auth = require('../middleware/auth');

// GET /api/expenses
router.get('/', async (req, res) => {
  try {
    const e = await Expense.find().sort({ expenseDate: -1 });
    res.json(e);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// POST /api/expenses
router.post('/', auth, async (req, res) => {
  try {
    const ex = new Expense(req.body);
    await ex.save();
    res.status(201).json(ex);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
});

module.exports = router;
