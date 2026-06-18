// routes/activity.js — teacher activity log
const express = require('express');
const router  = express.Router();
const db      = require('../db');
const auth    = require('../middleware/auth');

// GET /api/activity — teacher sees their own activity log
router.get('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teachers only.' });
    const rows = await db.all2(
      `SELECT al.*, u.name actor_name FROM activity_log al JOIN users u ON al.actor_id=u.id
       WHERE al.actor_id=? ORDER BY al.id DESC LIMIT 100`,
      [req.user.id]
    );
    res.json({ log: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/activity/search?q= — teacher search students/work
router.get('/search', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teachers only.' });
    const q = `%${req.query.q || ''}%`;
    const teacher = await db.get2('SELECT class, section FROM users WHERE id=?', [req.user.id]);
    const params  = [q, q, q];
    let classFilter = '';
    if (teacher?.class) { classFilter = ' AND u.class=?'; params.push(teacher.class); }

    const students = await db.all2(
      `SELECT id, name, roll_number, class, section, email, photo_url, 'student' type
       FROM users u WHERE role='student' AND (name LIKE ? OR roll_number LIKE ? OR email LIKE ?)${classFilter}
       LIMIT 10`, params
    );
    const work = await db.all2(
      `SELECT id, title, work_type, subject, due_date, status, 'work' type
       FROM work WHERE teacher_id=? AND (title LIKE ? OR subject LIKE ?) LIMIT 10`,
      [req.user.id, q, q]
    );
    res.json({ students, work });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
