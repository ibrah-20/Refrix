const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect, restrictTo } = require('../middleware/auth');

router.use(protect, restrictTo('admin'));

router.get('/dashboard', adminController.getDashboardStats);
router.get('/users', adminController.getUsers);
router.patch('/users/:userId/ban', adminController.banUser);
router.patch('/users/:userId/unban', adminController.unbanUser);
router.get('/withdrawals', adminController.getWithdrawals);
router.patch('/withdrawals/:withdrawalId/approve', adminController.approveWithdrawal);
router.patch('/withdrawals/:withdrawalId/reject', adminController.rejectWithdrawal);
router.get('/transactions', adminController.getTransactions);
router.get('/logs', adminController.getAdminLogs);

module.exports = router;
