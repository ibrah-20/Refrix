const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const withdrawalController = require('../controllers/withdrawalController');
const { protect } = require('../middleware/auth');

router.post(
  '/request',
  protect,
  [body('amount').isNumeric().withMessage('Amount must be a number')],
  withdrawalController.requestWithdrawal
);

router.get('/my-withdrawals', protect, withdrawalController.getMyWithdrawals);

module.exports = router;
