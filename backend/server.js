// server.js — PNU ASN Backend
const express = require('express');
const cors    = require('cors');
const dotenv  = require('dotenv');
const cron    = require('node-cron');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/students',      require('./routes/students'));
app.use('/api/attendance',    require('./routes/attendance'));
app.use('/api/timetable',     require('./routes/timetable'));
app.use('/api/examination',   require('./routes/examination'));
app.use('/api/leave',         require('./routes/leave'));
app.use('/api/messages',      require('./routes/messages'));
app.use('/api/calendar',      require('./routes/calendar'));
app.use('/api/fees',          require('./routes/fees'));
app.use('/api/work',          require('./routes/work'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/chat',          require('./routes/chat'));
app.use('/api/activity',      require('./routes/activity'));

// ── SSE real-time notification stream ────────────────────────────
const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'pnu_asn_secret';
const sseClients = new Map(); // userId → res

app.get('/api/sse', (req, res) => {
  try {
    const token = req.query.token;
    const decoded = jwt.verify(token, SECRET);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();
    sseClients.set(decoded.id, res);
    // Heartbeat every 25s to keep connection alive
    const hb = setInterval(() => res.write(': heartbeat\n\n'), 25000);
    req.on('close', () => { clearInterval(hb); sseClients.delete(decoded.id); });
  } catch { res.status(401).end(); }
});

// Export sseClients so notify utility can push events
app.locals.sseClients = sseClients;

app.get('/api/health', (req, res) => res.json({ status: 'PNU ASN API running ✅', version: '2.0.0' }));

// Serve locally uploaded files (when Cloudinary is not configured)
const path = require('path');
const fs   = require('fs');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', require('express').static(uploadsDir));

// Global JSON error handler — stops HTML error pages reaching the client
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error.' });
});

// Cron: expire work files daily at midnight
cron.schedule('0 0 * * *', async () => {
  console.log('🕛 Running work expiry cron...');
  const db = require('./db');
  const { cloudinary } = require('./utils/upload');
  try {
    const expired = await db.all2(
      "SELECT w.id, wa.public_id, wa.file_type FROM work w LEFT JOIN work_attachments wa ON wa.work_id=w.id WHERE w.status='active' AND w.expires_at < datetime('now')"
    );
    const workIds = [...new Set(expired.map(e => e.id))];
    for (const id of workIds) {
      const files = expired.filter(e => e.id === id && e.public_id);
      for (const f of files) {
        const rtype = f.file_type?.startsWith('video') ? 'video' : f.file_type?.startsWith('image') ? 'image' : 'raw';
        await cloudinary.uploader.destroy(f.public_id, { resource_type: rtype }).catch(() => {});
      }
      await db.exec2("UPDATE work SET status='expired' WHERE id=?", [id]);
      console.log(`✅ Expired work ID ${id}`);
    }
  } catch (e) { console.error('Cron error:', e.message); }
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => console.log(`✅ PNU ASN Server running on http://localhost:${PORT}`));
// Make app available to notify utility for SSE push
global.__app = app;
