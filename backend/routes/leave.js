// routes/leave.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { notify } = require('../utils/notify');

router.get('/', auth, async (req, res) => {
  try {
    const requests = await db.all2('SELECT * FROM leave_requests WHERE student_id=? ORDER BY created_at DESC', [req.user.id]);
    res.json({ requests });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/class', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teachers only.' });
    const teacher = await db.get2('SELECT class, section FROM users WHERE id=?', [req.user.id]);
    let q = `SELECT lr.*, u.name student_name, u.class, u.section, u.roll_number FROM leave_requests lr JOIN users u ON lr.student_id=u.id WHERE 1=1`;
    const params = [];
    if (teacher?.class) { q += ' AND u.class=?'; params.push(teacher.class); }
    q += ' ORDER BY lr.created_at DESC';
    const requests = await db.all2(q, params);
    res.json({ requests });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { reason, leave_type = 'casual', from_date, to_date } = req.body;
    if (!reason || !from_date || !to_date) return res.status(400).json({ error: 'reason, from_date, to_date required.' });
    const result = await db.exec2('INSERT INTO leave_requests (student_id,reason,leave_type,from_date,to_date) VALUES (?,?,?,?,?)', [req.user.id, reason, leave_type, from_date, to_date]);
    res.status(201).json({ message: 'Leave request submitted.', id: result.lastID });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teachers only.' });
    const { status, teacher_remark } = req.body;
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: "Status must be 'approved' or 'rejected'." });
    const leave = await db.get2('SELECT student_id FROM leave_requests WHERE id=?', [req.params.id]);
    await db.exec2("UPDATE leave_requests SET status=?,teacher_remark=?,reviewed_by=?,reviewed_at=datetime('now') WHERE id=?", [status, teacher_remark || null, req.user.id, req.params.id]);
    if (leave) {
      await notify({ userId: leave.student_id, title: `Leave ${status.charAt(0).toUpperCase()+status.slice(1)}`, body: teacher_remark || `Your leave request has been ${status}.`, type: 'leave' });
    }
    res.json({ message: `Leave ${status}.` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
