const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const { authenticate } = require('../middleware/auth');

// GET /api/notifications - Get user notifications
router.get('/', authenticate, async (req, res) => {
  try {
    const [notifications] = await pool.query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.user.user_id]
    );
    
    const [unreadCount] = await pool.query(
      'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = FALSE',
      [req.user.user_id]
    );

    res.json({ notifications, unread_count: unreadCount[0].count });
  } catch (err) {
    console.error('Notifications error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/notifications/:id/read - Mark notification as read
router.put('/:id/read', authenticate, async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE notification_id = ? AND user_id = ?',
      [req.params.id, req.user.user_id]
    );
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/notifications/read-all - Mark all as read
router.put('/read-all', authenticate, async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = ?',
      [req.user.user_id]
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
