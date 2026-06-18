// routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const auth = require('../middleware/auth');
const { generateOTP, sendOTP, sendNotificationEmail } = require('../utils/mailer');

const SECRET = process.env.JWT_SECRET || 'pnu_asn_secret';

// ── POST /api/auth/register ──────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role = 'student', class: cls, section, student_id } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'Name, email and password are required.' });
    const hash = bcrypt.hashSync(password, 10);
    const result = await db.exec2(
      'INSERT INTO users (name, email, password, role, class, section, student_id, email_verified) VALUES (?,?,?,?,?,?,?,0)',
      [name, email, hash, role, cls || null, section || null, student_id || null]
    );
    // Send verification OTP
    const otp = generateOTP();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
    await db.exec2('INSERT INTO otp_codes (email, code, expires_at, purpose) VALUES (?,?,?,?)', [email, otp, expires, 'verify']);
    try {
      await sendNotificationEmail(email, 'PNU ASN — Verify your email',
        `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f9fafb;border-radius:12px">
          <h2 style="color:#1a1d2e">🎓 PNU ASN — Welcome, ${name}!</h2>
          <p>Your verification code:</p>
          <div style="background:#1a1d2e;color:#fff;font-size:36px;font-weight:800;letter-spacing:12px;text-align:center;padding:20px 32px;border-radius:10px;margin:24px 0">${otp}</div>
          <p style="color:#6b7280;font-size:13px">Enter this code to activate your account. Expires in 24 hours.</p>
        </div>`
      );
    } catch (mailErr) { console.error('[mailer] verification email failed:', mailErr.message); }
    res.status(201).json({ message: 'Account created! Check your email for a verification code.', userId: result.lastID, requiresVerification: true });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email already registered.' });
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ── POST /api/auth/verify-email ──────────────────────────────────
router.post('/verify-email', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const record = await db.get2(
      "SELECT * FROM otp_codes WHERE email=? AND code=? AND (purpose='verify' OR purpose IS NULL) AND used=0 AND expires_at > datetime('now') ORDER BY id DESC LIMIT 1",
      [email, otp]
    );
    if (!record) return res.status(400).json({ error: 'Invalid or expired verification code.' });
    await db.exec2('UPDATE users SET email_verified=1 WHERE email=?', [email]);
    await db.exec2('UPDATE otp_codes SET used=1 WHERE id=?', [record.id]);
    res.json({ message: 'Email verified successfully! You can now log in.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/auth/resend-verification ──────────────────────────
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await db.get2('SELECT id, name, email_verified FROM users WHERE email=?', [email]);
    if (!user) return res.status(404).json({ error: 'Email not found.' });
    if (user.email_verified) return res.status(400).json({ error: 'Email already verified.' });
    const otp = generateOTP();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await db.exec2("UPDATE otp_codes SET used=1 WHERE email=? AND purpose='verify'", [email]);
    await db.exec2('INSERT INTO otp_codes (email, code, expires_at, purpose) VALUES (?,?,?,?)', [email, otp, expires, 'verify']);
    try {
      await sendNotificationEmail(email, 'PNU ASN — New Verification Code',
        `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f9fafb;border-radius:12px">
          <h2 style="color:#1a1d2e">🎓 PNU ASN</h2>
          <p>Your new verification code:</p>
          <div style="background:#1a1d2e;color:#fff;font-size:36px;font-weight:800;letter-spacing:12px;text-align:center;padding:20px 32px;border-radius:10px;margin:24px 0">${otp}</div>
          <p style="color:#6b7280;font-size:13px">Expires in 24 hours.</p>
        </div>`
      );
    } catch (mailErr) {
      return res.status(500).json({ error: 'Failed to send email. Check SMTP settings.' });
    }
    res.json({ message: 'Verification code sent.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/auth/login ─────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
    const user = await db.get2('SELECT * FROM users WHERE email = ?', [email]);
    if (!user || !bcrypt.compareSync(password, user.password))
      return res.status(401).json({ error: 'Invalid email or password.' });
    if (!user.email_verified)
      return res.status(403).json({ error: 'Please verify your email before logging in.', requiresVerification: true, email });
    const token = jwt.sign(
      { id: user.id, name: user.name, role: user.role, class: user.class, section: user.section },
      SECRET, { expiresIn: '30d' }
    );
    res.json({
      message: 'Login successful!', token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, class: user.class, section: user.section, photo_url: user.photo_url, grade: user.grade },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/auth/forgot-password ──────────────────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await db.get2('SELECT id FROM users WHERE email = ?', [email]);
    if (!user) return res.status(404).json({ error: 'Email not found.' });
    const otp = generateOTP();
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await db.exec2('INSERT INTO otp_codes (email, code, expires_at, purpose) VALUES (?,?,?,?)', [email, otp, expires, 'reset']);
    try {
      await sendOTP(email, otp);
    } catch (mailErr) {
      console.error('[mailer] forgot-password sendOTP failed:', mailErr.message);
      return res.status(500).json({ error: 'Failed to send OTP email. Please check SMTP settings or try again.' });
    }
    res.json({ message: 'OTP sent to your email.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/auth/verify-otp ────────────────────────────────────
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const record = await db.get2(
      "SELECT * FROM otp_codes WHERE email=? AND code=? AND (purpose='reset' OR purpose IS NULL) AND used=0 AND expires_at > datetime('now') ORDER BY id DESC LIMIT 1",
      [email, otp]
    );
    if (!record) return res.status(400).json({ error: 'Invalid or expired OTP.' });
    res.json({ message: 'OTP verified.', valid: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/auth/reset-password ───────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, new_password } = req.body;
    const record = await db.get2(
      "SELECT * FROM otp_codes WHERE email=? AND code=? AND (purpose='reset' OR purpose IS NULL) AND used=0 AND expires_at > datetime('now') ORDER BY id DESC LIMIT 1",
      [email, otp]
    );
    if (!record) return res.status(400).json({ error: 'Invalid or expired OTP.' });
    const hash = bcrypt.hashSync(new_password, 10);
    await db.exec2('UPDATE users SET password=? WHERE email=?', [hash, email]);
    await db.exec2('UPDATE otp_codes SET used=1 WHERE id=?', [record.id]);
    res.json({ message: 'Password reset successfully.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/auth/send-change-otp ──────────────────────────────
router.post('/send-change-otp', auth, async (req, res) => {
  try {
    const user = await db.get2('SELECT email FROM users WHERE id=?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const otp     = generateOTP();
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await db.exec2("UPDATE otp_codes SET used=1 WHERE email=? AND used=0", [user.email]);
    await db.exec2('INSERT INTO otp_codes (email, code, expires_at, purpose) VALUES (?,?,?,?)', [user.email, otp, expires, 'reset']);
    try {
      await sendOTP(user.email, otp);
    } catch (mailErr) {
      console.error('[mailer] send-change-otp failed:', mailErr.message);
      return res.status(500).json({ error: 'Failed to send OTP email. Please check SMTP settings or try again.' });
    }
    const masked = user.email.replace(/(.{1,2})(.*)(@.*)/, (_, a, b, c) => a + '*'.repeat(Math.max(2, b.length)) + c);
    res.json({ message: 'OTP sent.', maskedEmail: masked });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/auth/change-password-otp ───────────────────────────
router.put('/change-password-otp', auth, async (req, res) => {
  try {
    const { otp, new_password } = req.body;
    if (!otp || !new_password) return res.status(400).json({ error: 'OTP and new password are required.' });
    if (new_password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    const user = await db.get2('SELECT email FROM users WHERE id=?', [req.user.id]);
    const record = await db.get2(
      "SELECT * FROM otp_codes WHERE email=? AND code=? AND used=0 AND expires_at > datetime('now') ORDER BY id DESC LIMIT 1",
      [user.email, otp]
    );
    if (!record) return res.status(400).json({ error: 'Invalid or expired OTP.' });
    const hash = bcrypt.hashSync(new_password, 10);
    await db.exec2('UPDATE users SET password=? WHERE id=?', [hash, req.user.id]);
    await db.exec2('UPDATE otp_codes SET used=1 WHERE id=?', [record.id]);
    res.json({ message: 'Password changed successfully.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
  {resolute.app}
});

// ── PUT /api/auth/change-password ───────────────────────────────
router.put('/change-password', auth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'current_password and new_password are required.' });
    if (new_password.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    const user = await db.get2('SELECT * FROM users WHERE id=?', [req.user.id]);
    if (!bcrypt.compareSync(current_password, user.password)) return res.status(401).json({ error: 'Current password is incorrect.' });
    const hash = bcrypt.hashSync(new_password, 10);
    await db.exec2('UPDATE users SET password=? WHERE id=?', [hash, req.user.id]);
    res.json({ message: 'Password changed successfully.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/auth/fcm-token ──────────────────────────────────────
router.put('/fcm-token', auth, async (req, res) => {
  try {
    await db.exec2('UPDATE users SET fcm_token=? WHERE id=?', [req.body.token, req.user.id]);
    res.json({ message: 'FCM token saved.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
