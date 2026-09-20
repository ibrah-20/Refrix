const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', notificationController.getMyNotifications);
router.patch('/read-all', notificationController.markAllNotificationsRead);
router.patch('/:notifId/read', notificationController.markNotificationRead);

module.exports = router;
