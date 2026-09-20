const { notificationRepository } = require('../repositories');
const logger = require('../utils/logger');

// Get current user's notifications
exports.getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { limit = 50 } = req.query;

    const rawNotifs = await notificationRepository.findByUser(userId, parseInt(limit, 10));

    const notifications = rawNotifs.map((n) => ({
      id: n.id,
      _id: n.id,
      type: n.type,
      channel: n.channel,
      title: n.title,
      message: n.message,
      read: n.read,
      readAt: n.read_at,
      metadata: n.metadata,
      createdAt: n.created_at,
    }));

    res.json({ success: true, notifications });
  } catch (error) {
    logger.error('getMyNotifications error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications.' });
  }
};

// Mark single notification as read
exports.markNotificationRead = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { notifId } = req.params;

    const notif = await notificationRepository.markAsRead(notifId, userId);
    if (!notif) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }

    res.json({ success: true, message: 'Notification marked as read.' });
  } catch (error) {
    logger.error('markNotificationRead error:', error);
    res.status(500).json({ success: false, message: 'Failed to update notification.' });
  }
};

// Mark all notifications as read for current user
exports.markAllNotificationsRead = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    await notificationRepository.markAllAsReadForUser(userId);

    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (error) {
    logger.error('markAllNotificationsRead error:', error);
    res.status(500).json({ success: false, message: 'Failed to update notifications.' });
  }
};
