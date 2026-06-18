// routes/students.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { uploadPhoto, cloudinary, normaliseFile } = require('../utils/upload');

// GET /api/students/me — works for both students and teachers
router.get('/me', auth, async (req, res) => {
  try {
    const user = await db.get2(
      'SELECT id,name,email,role,class,section,roll_number,student_id,academic_year,grade,photo_url,father_name,mother_name,parent_phone,emergency_contact,remarks FROM users WHERE id=?',
      [req.user.id]
    );
    if (!user) return res.status(404).json({ error: 'Not found.' });

    // Teachers just get their profile — no student stats needed
    if (user.role === 'teacher') {
      return res.json({ profile: user, quickStats: {} });
    }

    // Students get full stats
    const [total, present, late, pending_leave, pending_work, unread_notifs] = await Promise.all([
      db.get2('SELECT COUNT(*) c FROM attendance WHERE student_id=?', [req.user.id]),
      db.get2("SELECT COUNT(*) c FROM attendance WHERE student_id=? AND status='present'", [req.user.id]),
      db.get2('SELECT COUNT(*) c FROM attendance WHERE student_id=? AND is_late=1', [req.user.id]),
      db.get2("SELECT COUNT(*) c FROM leave_requests WHERE student_id=? AND status='pending'", [req.user.id]),
      db.get2(`SELECT COUNT(*) c FROM work w LEFT JOIN work_submissions ws ON ws.work_id=w.id AND ws.student_id=? WHERE w.class=? AND (ws.id IS NULL OR ws.status='pending') AND w.status='active'`, [req.user.id, user.class]),
      db.get2('SELECT COUNT(*) c FROM notifications WHERE user_id=? AND is_read=0', [req.user.id]),
    ]);

    const att = total.c > 0 ? Math.round((present.c / total.c) * 100) : 0;
    const fees = await db.get2(
      'SELECT SUM(total_amount) total, SUM(paid_amount) paid FROM fees WHERE student_id=?',
      [req.user.id]
    );

    res.json({
      profile: user,
      quickStats: {
        attendance: `${att}%`,
        presentDays: present.c,
        totalDays: total.c,
        lateDays: late.c,
        pendingLeave: pending_leave.c,
        pendingWork: pending_work.c,
        unreadNotifs: unread_notifs.c,
        totalFees: fees?.total || 0,
        paidFees: fees?.paid || 0,
      },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/students — teacher gets all students in their class
router.get('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teachers only.' });
    const teacher = await db.get2('SELECT class, section FROM users WHERE id=?', [req.user.id]);
    let q = "SELECT id,name,email,class,section,roll_number,student_id,grade,photo_url,remarks FROM users WHERE role='student'";
    const params = [];
    if (teacher?.class) { q += ' AND class=?'; params.push(teacher.class); }
    if (teacher?.section) { q += ' AND section=?'; params.push(teacher.section); }
    q += ' ORDER BY roll_number, name';
    const students = await db.all2(q, params);
    res.json({ students });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/students/:id — teacher gets full student profile
router.get('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teachers only.' });
    const student = await db.get2(
      'SELECT id,name,email,class,section,roll_number,student_id,academic_year,grade,photo_url,father_name,mother_name,parent_phone,emergency_contact,remarks FROM users WHERE id=? AND role=?',
      [req.params.id, 'student']
    );
    if (!student) return res.status(404).json({ error: 'Student not found.' });

    const [att_total, att_present, att_late] = await Promise.all([
      db.get2('SELECT COUNT(*) c FROM attendance WHERE student_id=?', [req.params.id]),
      db.get2("SELECT COUNT(*) c FROM attendance WHERE student_id=? AND status='present'", [req.params.id]),
      db.get2('SELECT COUNT(*) c FROM attendance WHERE student_id=? AND is_late=1', [req.params.id]),
    ]);

    const results = await db.all2(`
      SELECT er.marks, er.total_marks, er.grade, e.subject, e.exam_date, e.exam_type
      FROM exam_results er JOIN examinations e ON er.exam_id=e.id
      WHERE er.student_id=? ORDER BY e.exam_date DESC LIMIT 10
    `, [req.params.id]);

    const fees = await db.get2(
      'SELECT SUM(total_amount) total, SUM(paid_amount) paid, MAX(last_payment_date) last_pay FROM fees WHERE student_id=?',
      [req.params.id]
    );

    const leave = await db.all2(
      'SELECT * FROM leave_requests WHERE student_id=? ORDER BY created_at DESC LIMIT 10',
      [req.params.id]
    );

    res.json({
      student,
      attendance: {
        total: att_total.c, present: att_present.c,
        absent: att_total.c - att_present.c,
        late: att_late.c,
        percentage: att_total.c > 0 ? Math.round((att_present.c / att_total.c) * 100) : 0,
      },
      results, fees, leave,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// PUT /api/students/me — any user updates their own profile (teacher sets their class/section)
router.put('/me', auth, async (req, res) => {
  try {
    const { class: cls, section } = req.body;
    await db.exec2(
      'UPDATE users SET class=?, section=? WHERE id=?',
      [cls || null, section || null, req.user.id]
    );
    const updated = await db.get2(
      'SELECT id, name, email, role, class, section, photo_url, grade FROM users WHERE id=?',
      [req.user.id]
    );
    res.json({ message: 'Profile updated.', user: updated });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/students/:id — teacher updates student profile
router.put('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teachers only.' });
    const { class: cls, section, roll_number, grade, student_id, father_name, mother_name, parent_phone, emergency_contact, remarks, academic_year } = req.body;
    await db.exec2(
      'UPDATE users SET class=?,section=?,roll_number=?,grade=?,student_id=?,father_name=?,mother_name=?,parent_phone=?,emergency_contact=?,remarks=?,academic_year=? WHERE id=? AND role=?',
      [cls, section, roll_number, grade, student_id, father_name, mother_name, parent_phone, emergency_contact, remarks, academic_year, req.params.id, 'student']
    );
    res.json({ message: 'Student updated.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/students/:id/photo — teacher assigns student photo
router.post('/:id/photo', auth, (req, res, next) => {
  uploadPhoto.single('photo')(req, res, (err) => {
    console.log(req.file)
    console.log(req.body)
    if (err) return res.status(400).json({ error: err.message || 'Photo upload failed.' });
    next();
  });
}, async (req, res) => {
  
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teachers only.' });
    if (!req.file) return res.status(400).json({ error: 'No photo uploaded.' });
    const norm = normaliseFile(req.file);
    // Delete old Cloudinary photo if applicable
    if (cloudinary) {
      const old2 = await db.get2('SELECT photo_public_id FROM users WHERE id=?', [req.params.id]);
      if (old2?.photo_public_id) await cloudinary.uploader.destroy(old2.photo_public_id).catch(() => {});
    }
    await db.exec2('UPDATE users SET photo_url=?, photo_public_id=? WHERE id=?', [norm.url, norm.publicId, req.params.id]);
    res.json({ message: 'Photo updated.', photo_url: norm.url });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;