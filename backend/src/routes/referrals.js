const express = require('express');
const router = express.Router();
const referralController = require('../controllers/referralController');
const { protect } = require('../middleware/auth');

router.get('/my-referrals', protect, referralController.getMyReferrals);
router.get('/link', protect, referralController.getReferralLink);
router.get('/referred-by', protect, referralController.getReferredBy);

module.exports = router;
