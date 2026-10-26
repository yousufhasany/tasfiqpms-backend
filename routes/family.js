const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const family = require('../controllers/familyController');

router.use(auth, family.requireFamily);
router.get('/', family.getDashboard);
router.get('/members/:id', family.getMember);
router.post('/members', family.addMember);
router.delete('/members/:id', family.deleteMember);
router.post('/deposit', family.deposit);
router.post('/spend', family.spend);
router.post('/transfer', family.transfer);
router.put('/transactions/:id', family.updateTransaction);
router.delete('/transactions/:id', family.deleteTransaction);

module.exports = router;
