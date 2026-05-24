const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

router.post('/initiate', protect, paymentController.initiatePayment);
router.post('/callback', paymentController.mpesaCallback);
router.get('/query/:checkoutRequestId', protect, paymentController.queryPayment);
router.get('/my-transactions', protect, paymentController.getMyTransactions);

module.exports = router;
