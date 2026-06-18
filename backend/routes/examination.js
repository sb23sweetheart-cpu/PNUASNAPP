// routes/examination.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { notify, notifyClass } = require('../utils/notify');

router.get('/', auth, async (req, res) => {
  try {
    const user = await db.get2('SELECT class, section FROM users WHERE id=?', [req.user.id]);
    const exams = await db.all2('SELECT * FROM examinations WHERE class=? ORDER BY exam_date ASC', [user?.class || '']);
    res.json({ exams });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/results', auth, async (req, res) => {
  try {
    const results = await db.all2(`
      SELECT er.marks, er.total_marks, er.grade, er.remarks, e.subject, e.exam_date, e.exam_type
      FROM exam_results er JOIN examinations e ON er.exam_id=e.id
      WHERE er.student_id=? ORDER BY e.exam_date DESC
    `, [req.user.id]);
    res.json({ results });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teachers only.' });
    const { section, subject, exam_date, exam_type = 'unit', total_marks = 100 } = req.body;
    let cls = req.body.class;

    // Auto-fallback: if class not sent, read from teacher's DB profile
    if (!cls) {
      const teacher = await db.get2('SELECT class FROM users WHERE id=?', [req.user.id]);
      cls = teacher?.class || '';
    }

    if (!cls || !subject || !exam_date) return res.status(400).json({ error: 'class, subject, exam_date required.' });
    const result = await db.exec2('INSERT INTO examinations (class,section,subject,exam_date,exam_type,total_marks,created_by) VALUES (?,?,?,?,?,?,?)', [cls, section || null, subject, exam_date, exam_type, total_marks, req.user.id]);
    await notifyClass(cls, section || null, { title: `Exam Scheduled: ${subject}`, body: `${exam_type} on ${exam_date}`, type: 'exam' });
    res.status(201).json({ message: 'Exam created.', id: result.lastID });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/results', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teachers only.' });
    const { student_id, exam_id, marks, total_marks = 100, grade, remarks } = req.body;
    if (!student_id || !exam_id || marks === undefined) return res.status(400).json({ error: 'student_id, exam_id, marks required.' });
    const computedGrade = grade || computeGrade(marks, total_marks);
    await db.exec2(`
      INSERT INTO exam_results (student_id,exam_id,marks,total_marks,grade,remarks,entered_by)
      VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(student_id,exam_id) DO UPDATE SET marks=excluded.marks, total_marks=excluded.total_marks, grade=excluded.grade, remarks=excluded.remarks, entered_by=excluded.entered_by
    `, [student_id, exam_id, marks, total_marks, computedGrade, remarks || null, req.user.id]);
    const exam = await db.get2('SELECT subject FROM examinations WHERE id=?', [exam_id]);
    await notify({ userId: student_id, title: 'Result Published', body: `${exam?.subject}: ${marks}/${total_marks} — Grade ${computedGrade}`, type: 'result' });
    res.status(201).json({ message: 'Result saved.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/class-results', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teachers only.' });
    const teacher = await db.get2('SELECT class FROM users WHERE id=?', [req.user.id]);
    const results = await db.all2(`
      SELECT er.marks, er.total_marks, er.grade, u.name student_name, e.subject, e.exam_date, e.exam_type
      FROM exam_results er JOIN users u ON er.student_id=u.id JOIN examinations e ON er.exam_id=e.id
      WHERE u.class=? ORDER BY e.exam_date DESC, u.name
    `, [teacher?.class || '']);
    res.json({ results });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

function computeGrade(marks, total) {
  const pct = (marks / total) * 100;
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  if (pct >= 40) return 'D';
  return 'F';
}

module.exports = router;
