// routes/attendance.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { notify } = require('../utils/notify');
const { logActivity } = require('../utils/activityLogger');

// GET /api/attendance — student views own attendance
router.get('/', auth, async (req, res) => {
  try {
    const records = await db.all2(
      'SELECT * FROM attendance WHERE student_id=? ORDER BY date DESC',
      [req.user.id]
    );
    const total = records.length;
    const present = records.filter(r => r.status === 'present').length;
    const late = records.filter(r => r.is_late).length;
    const pct = total > 0 ? Math.round((present / total) * 100) : 0;
    res.json({ percentage: `${pct}%`, present, absent: total - present, late, total, records });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/attendance/class?date=YYYY-MM-DD — teacher views class attendance
router.get('/class', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teachers only.' });
    const teacher = await db.get2('SELECT class, section FROM users WHERE id=?', [req.user.id]);
    const { date, month, year } = req.query;
    let q = `SELECT a.*, u.name student_name, u.roll_number FROM attendance a
             JOIN users u ON a.student_id=u.id WHERE u.class=?`;
    const params = [teacher?.class || ''];
    if (teacher?.section) { q += ' AND u.section=?'; params.push(teacher.section); }
    if (date) { q += ' AND a.date=?'; params.push(date); }
    else if (month && year) {
      q += " AND strftime('%m', a.date)=? AND strftime('%Y', a.date)=?";
      params.push(String(month).padStart(2, '0'), year);
    }
    q += ' ORDER BY a.date DESC, u.roll_number';
    const records = await db.all2(q, params);
    res.json({ records });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/attendance — teacher marks bulk attendance for a date
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teachers only.' });
    const { date, records } = req.body;
    // records: [{ student_id, status, is_late, leave_reason }]
    if (!date || !Array.isArray(records)) return res.status(400).json({ error: 'date and records[] required.' });
    for (const r of records) {
      await db.exec2(`
        INSERT INTO attendance (student_id, date, status, is_late, leave_reason, marked_by)
        VALUES (?,?,?,?,?,?)
        ON CONFLICT(student_id, date) DO UPDATE SET status=excluded.status, is_late=excluded.is_late, leave_reason=excluded.leave_reason, marked_by=excluded.marked_by
      `, [r.student_id, date, r.status || 'present', r.is_late ? 1 : 0, r.leave_reason || null, req.user.id]);
      // Notify if absent
      if (r.status === 'absent') {
        await notify({ userId: r.student_id, title: 'Attendance Marked', body: `You were marked absent on ${date}. Reason: ${r.leave_reason || 'N/A'}`, type: 'attendance' });
      }
    }
    await logActivity(req.user.id, 'Marked attendance', 'attendance', null, `Date: ${date}, ${records.length} students`);
    res.json({ message: 'Attendance saved.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/attendance/report/:studentId — teacher views student monthly report
router.get('/report/:studentId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teachers only.' });
    const { month, year } = req.query;
    let q = 'SELECT * FROM attendance WHERE student_id=?';
    const params = [req.params.studentId];
    if (month && year) {
      q += " AND strftime('%m',date)=? AND strftime('%Y',date)=?";
      params.push(String(month).padStart(2, '0'), year);
    }
    q += ' ORDER BY date';
    const records = await db.all2(q, params);
    const total = records.length;
    const present = records.filter(r => r.status === 'present').length;
    const late = records.filter(r => r.is_late).length;
    res.json({ records, summary: { total, present, absent: total - present, late, percentage: total > 0 ? Math.round((present / total) * 100) : 0 } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
