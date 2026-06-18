// routes/calendar.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const user = await db.get2('SELECT class FROM users WHERE id=?', [req.user.id]);
    const events = await db.all2(
      "SELECT * FROM calendar_events WHERE class IS NULL OR class=? ORDER BY event_date ASC",
      [user?.class || '']
    );
    res.json({ events });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teachers only.' });
    const { title, description, event_date, end_date, event_type = 'general', class: cls } = req.body;
    if (!title || !event_date) return res.status(400).json({ error: 'title and event_date required.' });
    const result = await db.exec2('INSERT INTO calendar_events (title,description,event_date,end_date,event_type,class,created_by) VALUES (?,?,?,?,?,?,?)', [title, description || '', event_date, end_date || null, event_type, cls || null, req.user.id]);
    res.status(201).json({ message: 'Event added.', id: result.lastID });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teachers only.' });
    await db.exec2('DELETE FROM calendar_events WHERE id=?', [req.params.id]);
    res.json({ message: 'Deleted.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
