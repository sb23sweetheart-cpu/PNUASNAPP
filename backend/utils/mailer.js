// utils/mailer.js — Nodemailer OTP
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendOTP(email, otp) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || '"PNU ASN" <noreply@pnu-asn.com>',
    to: email,
    subject: 'PNU ASN — Password Reset OTP',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f9fafb;border-radius:12px">
        <h2 style="color:#1a1d2e;font-size:24px;margin-bottom:8px">🎓 PNU ASN</h2>
        <p style="color:#374151;font-size:15px">Your OTP for password reset:</p>
        <div style="background:#1a1d2e;color:#fff;font-size:36px;font-weight:800;letter-spacing:12px;text-align:center;padding:20px 32px;border-radius:10px;margin:24px 0">${otp}</div>
        <p style="color:#6b7280;font-size:13px">This OTP expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
        <p style="color:#9ca3af;font-size:12px;margin-top:24px">PNU ASN School Management System</p>
      </div>
    `,
  });
}

async function sendNotificationEmail(email, subject, html) {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"PNU ASN" <noreply@pnu-asn.com>',
      to: email, subject, html,
    });
  } catch (e) { console.error('Email error:', e.message); }
}

module.exports = { generateOTP, sendOTP, sendNotificationEmail };
