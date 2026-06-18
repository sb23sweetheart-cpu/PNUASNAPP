// routes/fees.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { notify } = require('../utils/notify');

// GET /api/fees — student views own fees
router.get('/', auth, async (req, res) => {
  try {
    const fees = await db.all2('SELECT * FROM fees WHERE student_id=? ORDER BY created_at DESC', [req.user.id]);
    const total = fees.reduce((s, f) => s + f.total_amount, 0);
    const paid = fees.reduce((s, f) => s + f.paid_amount, 0);
    res.json({ fees, summary: { total, paid, pending: total - paid } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/fees/class — teacher views class fees overview
router.get('/class', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teachers only.' });
    const teacher = await db.get2('SELECT class, section FROM users WHERE id=?', [req.user.id]);
    let q = `SELECT u.id, u.name, u.roll_number, u.class, u.section,
             COALESCE(SUM(f.total_amount),0) total, COALESCE(SUM(f.paid_amount),0) paid
             FROM users u LEFT JOIN fees f ON f.student_id=u.id
             WHERE u.role='student'`;
    const params = [];
    if (teacher?.class) { q += ' AND u.class=?'; params.push(teacher.class); }
    if (teacher?.section) { q += ' AND u.section=?'; params.push(teacher.section); }
    q += ' GROUP BY u.id ORDER BY u.roll_number';
    const students = await db.all2(q, params);
    const totalCollected = students.reduce((s, s2) => s + s2.paid, 0);
    const totalPending = students.reduce((s, s2) => s + (s2.total - s2.paid), 0);
    const unpaidCount = students.filter(s => s.total > s.paid).length;
    res.json({ students, summary: { totalCollected, totalPending, unpaidCount } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/fees/student/:id — teacher views specific student fees
router.get('/student/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teachers only.' });
    const fees = await db.all2('SELECT * FROM fees WHERE student_id=? ORDER BY created_at DESC', [req.params.id]);
    const total = fees.reduce((s, f) => s + f.total_amount, 0);
    const paid = fees.reduce((s, f) => s + f.paid_amount, 0);
    res.json({ fees, summary: { total, paid, pending: total - paid } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/fees — teacher adds fee record for a student
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teachers only.' });
    const { student_id, fee_type, total_amount, paid_amount = 0, due_date, academic_year = '2024-25', notes } = req.body;
    if (!student_id || !fee_type || !total_amount) return res.status(400).json({ error: 'student_id, fee_type, total_amount required.' });
    const result = await db.exec2(
      'INSERT INTO fees (student_id,fee_type,total_amount,paid_amount,due_date,academic_year,notes,payment_status) VALUES (?,?,?,?,?,?,?,?)',
      [student_id, fee_type, total_amount, paid_amount, due_date, academic_year, notes, paid_amount >= total_amount ? 'paid' : paid_amount > 0 ? 'partial' : 'pending']
    );
    await notify({ userId: student_id, title: 'Fee Update', body: `${fee_type}: ₹${total_amount} — Due: ${due_date || 'N/A'}`, type: 'fees', refId: result.lastID, refType: 'fee' });
    res.status(201).json({ message: 'Fee record added.', id: result.lastID });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/fees/:id — teacher updates fee (mark payment)
router.put('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teachers only.' });
    const { paid_amount, notes, last_payment_date } = req.body;
    const fee = await db.get2('SELECT * FROM fees WHERE id=?', [req.params.id]);
    if (!fee) return res.status(404).json({ error: 'Fee record not found.' });
    const newPaid = paid_amount !== undefined ? paid_amount : fee.paid_amount;
    const status = newPaid >= fee.total_amount ? 'paid' : newPaid > 0 ? 'partial' : 'pending';
    await db.exec2(
      'UPDATE fees SET paid_amount=?,payment_status=?,notes=?,last_payment_date=? WHERE id=?',
      [newPaid, status, notes || fee.notes, last_payment_date || fee.last_payment_date, req.params.id]
    );
    await notify({ userId: fee.student_id, title: 'Payment Recorded', body: `₹${newPaid} paid. Status: ${status}`, type: 'fees' });
    res.json({ message: 'Fee updated.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
