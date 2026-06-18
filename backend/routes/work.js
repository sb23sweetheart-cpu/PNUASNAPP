// routes/work.js
const express = require('express');
const router  = express.Router();
const db      = require('../db');
const auth    = require('../middleware/auth');
const { logActivity } = require('../utils/activityLogger');
const { uploadWork, cloudinary, normaliseFile } = require('../utils/upload');
const { notifyClass } = require('../utils/notify');

// Auto-expire work
async function expireWork() {
  try {
    const expired = await db.all2(
      "SELECT w.id, wa.public_id, wa.file_type FROM work w LEFT JOIN work_attachments wa ON wa.work_id=w.id WHERE w.status='active' AND w.expires_at < datetime('now')"
    );
    const workIds = [...new Set(expired.map(e => e.id))];
    for (const id of workIds) {
      if (cloudinary) {
        const files = expired.filter(e => e.id === id && e.public_id);
        for (const f of files) {
          const rtype = f.file_type?.startsWith('video') ? 'video' : f.file_type?.startsWith('image') ? 'image' : 'raw';
          await cloudinary.uploader.destroy(f.public_id, { resource_type: rtype }).catch(() => {});
        }
      }
      await db.exec2("UPDATE work SET status='expired' WHERE id=?", [id]);
    }
  } catch { /* silent */ }
}

// GET /api/work
router.get('/', auth, async (req, res) => {
  try {
    await expireWork();
    const { type, status = 'active' } = req.query;
    let q, params;

    if (req.user.role === 'teacher') {
      q = 'SELECT w.*, u.name teacher_name FROM work w JOIN users u ON w.teacher_id=u.id WHERE w.teacher_id=?';
      params = [req.user.id];
    } else {
      const student = await db.get2('SELECT class, section FROM users WHERE id=?', [req.user.id]);
      q = 'SELECT w.*, u.name teacher_name FROM work w JOIN users u ON w.teacher_id=u.id WHERE w.class=?';
      params = [student?.class || ''];
    }

    if (type)              { q += ' AND w.work_type=?'; params.push(type); }
    if (status !== 'all')  { q += ' AND w.status=?';   params.push(status); }
    q += ' ORDER BY w.created_at DESC';

    const items = await db.all2(q, params);

    for (const item of items) {
      item.attachments = await db.all2(
        'SELECT id,file_name,file_url,file_type,file_size FROM work_attachments WHERE work_id=?',
        [item.id]
      );
      if (req.user.role === 'student') {
        item.submission = await db.get2(
          'SELECT * FROM work_submissions WHERE work_id=? AND student_id=?',
          [item.id, req.user.id]
        );
      } else {
        item.submissionCounts = await db.get2(`
          SELECT COUNT(*) total,
            SUM(CASE WHEN status='submitted' OR status='reviewed' THEN 1 ELSE 0 END) submitted,
            SUM(CASE WHEN status='late' THEN 1 ELSE 0 END) late
          FROM work_submissions WHERE work_id=?
        `, [item.id]);
      }
    }

    res.json({ work: items });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/work — with multer error handling middleware
router.post('/', auth, (req, res, next) => {
  uploadWork.array('files', 10)(req, res, (err) => {
    if (err) {
      // Return JSON error instead of HTML crash page
      return res.status(400).json({ error: err.message || 'File upload failed.' });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teachers only.' });

    const { work_type, title, subject, description, instructions, section, due_date, is_important } = req.body;
    let cls = req.body.class;

    if (!cls) {
      const teacher = await db.get2('SELECT class FROM users WHERE id=?', [req.user.id]);
      cls = teacher?.class || '';
    }

    if (!work_type || !title || !subject || !cls || !due_date)
      return res.status(400).json({ error: 'work_type, title, subject, class, due_date required.' });

    const dueDate = new Date(due_date);
    const expires_at = work_type === 'homework'
      ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      : new Date(dueDate.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const result = await db.exec2(
      'INSERT INTO work (teacher_id,work_type,title,subject,description,instructions,class,section,due_date,is_important,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [req.user.id, work_type, title, subject, description || '', instructions || '', cls, section || null, due_date, is_important === 'true' || is_important === true ? 1 : 0, expires_at]
    );

    const workId = result.lastID;

    if (req.files?.length) {
      for (const file of req.files) {
        const norm = normaliseFile(file);
        await db.exec2(
          'INSERT INTO work_attachments (work_id,file_name,file_url,public_id,file_type,file_size) VALUES (?,?,?,?,?,?)',
          [workId, norm.originalname, norm.url, norm.publicId, norm.mimetype, norm.size]
        );
      }
    }

    const typeLabel = work_type === 'homework' ? 'Homework' : 'Assignment';
    await notifyClass(cls, section || null, {
      title: `New ${typeLabel}: ${title}`,
      body:  `${subject} — Due: ${due_date}`,
      type:  'work', refId: workId, refType: 'work',
    });

    await logActivity(req.user.id, 'Created work', 'work', workId, `${work_type}: ${title}`);
    res.status(201).json({ message: 'Work created.', id: workId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/work/:id
router.put('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teachers only.' });
    const { title, subject, description, instructions, due_date, is_important } = req.body;
    await db.exec2(
      'UPDATE work SET title=?,subject=?,description=?,instructions=?,due_date=?,is_important=? WHERE id=? AND teacher_id=?',
      [title, subject, description, instructions, due_date, is_important ? 1 : 0, req.params.id, req.user.id]
    );
    res.json({ message: 'Work updated.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/work/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teachers only.' });
    if (cloudinary) {
      const attachments = await db.all2('SELECT public_id FROM work_attachments WHERE work_id=?', [req.params.id]);
      for (const a of attachments) {
        if (a.public_id) await cloudinary.uploader.destroy(a.public_id, { resource_type: 'auto' }).catch(() => {});
      }
    }
    await db.exec2('DELETE FROM work WHERE id=? AND teacher_id=?', [req.params.id, req.user.id]);
    await logActivity(req.user.id, 'Deleted work', 'work', parseInt(req.params.id), null);
    res.json({ message: 'Work deleted.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/work/:id/submissions
router.get('/:id/submissions', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teachers only.' });
    const submissions = await db.all2(`
      SELECT ws.*, u.name student_name, u.roll_number
      FROM work_submissions ws JOIN users u ON ws.student_id=u.id
      WHERE ws.work_id=? ORDER BY ws.submitted_at DESC
    `, [req.params.id]);
    res.json({ submissions });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/work/:id/submission/:studentId
router.put('/:id/submission/:studentId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teachers only.' });
    const { status, remark } = req.body;
    await db.exec2(`
      INSERT INTO work_submissions (work_id,student_id,status,remark,reviewed_at,reviewed_by)
      VALUES (?,?,?,?,datetime('now'),?)
      ON CONFLICT(work_id,student_id) DO UPDATE SET
        status=excluded.status, remark=excluded.remark,
        reviewed_at=excluded.reviewed_at, reviewed_by=excluded.reviewed_by
    `, [req.params.id, req.params.studentId, status, remark, req.user.id]);
    await logActivity(req.user.id, 'Reviewed submission', 'work', parseInt(wid), `Student ${sid}: ${status}`);
    res.json({ message: 'Submission reviewed.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/work/:id/submit — student submits
router.post('/:id/submit', auth, async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Students only.' });
    const work = await db.get2('SELECT due_date FROM work WHERE id=?', [req.params.id]);
    const isLate = work && new Date() > new Date(work.due_date);
    await db.exec2(`
      INSERT INTO work_submissions (work_id,student_id,status,submitted_at)
      VALUES (?,?,?,datetime('now'))
      ON CONFLICT(work_id,student_id) DO UPDATE SET
        status=excluded.status, submitted_at=excluded.submitted_at
    `, [req.params.id, req.user.id, isLate ? 'late' : 'submitted']);
    res.json({ message: 'Submitted.', isLate });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
