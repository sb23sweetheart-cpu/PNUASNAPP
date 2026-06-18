// routes/messages.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const user = await db.get2('SELECT class FROM users WHERE id=?', [req.user.id]);
    const notices = await db.all2(`
      SELECT m.*, u.name sender_name FROM messages m JOIN users u ON m.sender_id=u.id
      WHERE m.target='all' OR m.target=? OR m.target=?
      ORDER BY m.created_at DESC
    `, [user?.class || '', req.user.role]);
    res.json({ notices, count: notices.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teachers only.' });
    const { title, body, target = 'all', priority = 'normal' } = req.body;
    if (!title || !body) return res.status(400).json({ error: 'title and body required.' });
    const result = await db.exec2('INSERT INTO messages (sender_id,title,body,target,priority) VALUES (?,?,?,?,?)', [req.user.id, title, body, target, priority]);
    res.status(201).json({ message: 'Notice posted.', id: result.lastID });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teachers only.' });
    await db.exec2('DELETE FROM messages WHERE id=? AND sender_id=?', [req.params.id, req.user.id]);
    res.json({ message: 'Deleted.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
