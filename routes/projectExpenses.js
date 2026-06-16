const express = require('express');
const router = express.Router();
const multer = require('multer');
const auth = require('../middleware/auth');
const ctrl = require('../controllers/projectExpenseController');

// Multer memory storage configuration for receipt images and PDFs
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and image files (JPEG, PNG, WEBP) are allowed'));
    }
  }
});

router.get('/', auth, ctrl.getExpenses);
router.post('/', auth, upload.single('attachment'), ctrl.createExpense);
router.put('/:id', auth, upload.single('attachment'), ctrl.updateExpense);
router.get('/:id/attachment', auth, ctrl.downloadAttachment);
router.delete('/:id', auth, ctrl.remove);

module.exports = router;
