// routes/timetable.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const user = await db.get2('SELECT class, section FROM users WHERE id=?', [req.user.id]);
    if (!user?.class) return res.json({ timetable: [], message: 'No class assigned.' });
    const rows = await db.all2(
      'SELECT t.*, u.name teacher_name FROM timetable t LEFT JOIN users u ON t.teacher_id=u.id WHERE t.class=? ORDER BY t.day, t.time_start',
      [user.class]
    );
    res.json({ class: user.class, section: user.section, timetable: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teachers only.' });
    const teacher = await db.get2('SELECT class, section FROM users WHERE id=?', [req.user.id]);
    if (!teacher?.class) return res.status(400).json({ error: 'No class assigned to you.' });
    const { day, subject, time_start, time_end } = req.body;
    if (!day || !subject || !time_start || !time_end) return res.status(400).json({ error: 'day, subject, time_start, time_end required.' });
    const result = await db.exec2(
      'INSERT INTO timetable (class, section, day, subject, time_start, time_end, teacher_id) VALUES (?,?,?,?,?,?,?)',
      [teacher.class, teacher.section || null, day, subject, time_start, time_end, req.user.id]
    );
    res.status(201).json({ message: 'Slot added.', id: result.lastID });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teachers only.' });
    await db.exec2('DELETE FROM timetable WHERE id=? AND teacher_id=?', [req.params.id, req.user.id]);
    res.json({ message: 'Slot removed.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
