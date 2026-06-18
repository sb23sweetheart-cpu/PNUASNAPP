// routes/notifications.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/notifications
router.get('/', auth, async (req, res) => {
  try {
    const notifs = await db.all2('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50', [req.user.id]);
    const unread = notifs.filter(n => !n.is_read).length;
    res.json({ notifications: notifs, unread });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/notifications/unread-counts — badge counts per type
router.get('/unread-counts', auth, async (req, res) => {
  try {
    const rows = await db.all2(
      "SELECT type, COUNT(*) c FROM notifications WHERE user_id=? AND is_read=0 GROUP BY type",
      [req.user.id]
    );
    const counts = {};
    rows.forEach(r => { counts[r.type] = r.c; });
    res.json({ counts, total: rows.reduce((s, r) => s + r.c, 0) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', auth, async (req, res) => {
  try {
    await db.exec2('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    res.json({ message: 'Marked as read.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/notifications/read-all
router.put('/read-all', auth, async (req, res) => {
  try {
    await db.exec2('UPDATE notifications SET is_read=1 WHERE user_id=?', [req.user.id]);
    res.json({ message: 'All marked as read.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
