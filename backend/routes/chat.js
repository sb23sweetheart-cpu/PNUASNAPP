// routes/chat.js
const express = require('express');
const router  = express.Router();
const db      = require('../db');
const auth    = require('../middleware/auth');
const { notify } = require('../utils/notify');

// ── MIGRATION: add reply_to_id and is_deleted columns if missing ──
db.run("ALTER TABLE chat_messages ADD COLUMN reply_to_id INTEGER", () => {});
db.run("ALTER TABLE chat_messages ADD COLUMN is_deleted INTEGER DEFAULT 0", () => {});

// GET /api/chat/contacts
router.get('/contacts', auth, async (req, res) => {
  try {
    let contacts;
    if (req.user.role === 'teacher') {
      const teacher = await db.get2('SELECT class, section FROM users WHERE id=?', [req.user.id]);
      let q = "SELECT id, name, role, photo_url, class, section FROM users WHERE role='student'";
      const p = [];
      if (teacher?.class) { q += ' AND class=?'; p.push(teacher.class); }
      contacts = await db.all2(q, p);
    } else {
      const student = await db.get2('SELECT class, section FROM users WHERE id=?', [req.user.id]);
      let q = "SELECT id, name, role, photo_url, class, section FROM users WHERE role='teacher'";
      const p = [];
      if (student?.class) { q += ' AND class=?'; p.push(student.class); }
      contacts = await db.all2(q, p);
    }
    for (const c of contacts) {
      const last = await db.get2(
        `SELECT body, created_at, is_deleted FROM chat_messages
         WHERE (sender_id=? AND receiver_id=?) OR (sender_id=? AND receiver_id=?)
         ORDER BY id DESC LIMIT 1`,
        [req.user.id, c.id, c.id, req.user.id]
      );
      const unread = await db.get2(
        `SELECT COUNT(*) c FROM chat_messages WHERE sender_id=? AND receiver_id=? AND is_read=0 AND is_deleted=0`,
        [c.id, req.user.id]
      );
      c.last_message = last ? (last.is_deleted ? 'Message unsent' : last.body) : null;
      c.last_at      = last?.created_at || null;
      c.unread       = unread?.c || 0;
    }
    contacts.sort((a, b) => (b.last_at || '').localeCompare(a.last_at || ''));
    res.json({ contacts });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/chat/:userId/poll?after=ID  ← MUST be before /:userId
router.get('/:userId/poll', auth, async (req, res) => {
  try {
    const other = parseInt(req.params.userId);
    const after = parseInt(req.query.after) || 0;
    const msgs = await db.all2(
      `SELECT cm.*, u.name sender_name, u.photo_url sender_photo,
              r.body reply_body, ru.name reply_sender_name
       FROM chat_messages cm
       JOIN users u ON cm.sender_id = u.id
       LEFT JOIN chat_messages r  ON cm.reply_to_id = r.id
       LEFT JOIN users ru ON r.sender_id = ru.id
       WHERE ((cm.sender_id=? AND cm.receiver_id=?) OR (cm.sender_id=? AND cm.receiver_id=?))
         AND cm.id > ?
       ORDER BY cm.id ASC`,
      [req.user.id, other, other, req.user.id, after]
    );
    if (msgs.length) {
      await db.exec2(
        'UPDATE chat_messages SET is_read=1 WHERE sender_id=? AND receiver_id=? AND is_read=0',
        [other, req.user.id]
      );
    }
    res.json({ messages: msgs });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/chat/:userId — conversation history
router.get('/:userId', auth, async (req, res) => {
  try {
    const other = parseInt(req.params.userId);
    const msgs = await db.all2(
      `SELECT cm.*, u.name sender_name, u.photo_url sender_photo,
              r.body reply_body, ru.name reply_sender_name
       FROM chat_messages cm
       JOIN users u ON cm.sender_id = u.id
       LEFT JOIN chat_messages r  ON cm.reply_to_id = r.id
       LEFT JOIN users ru ON r.sender_id = ru.id
       WHERE (cm.sender_id=? AND cm.receiver_id=?) OR (cm.sender_id=? AND cm.receiver_id=?)
       ORDER BY cm.id ASC LIMIT 100`,
      [req.user.id, other, other, req.user.id]
    );
    await db.exec2(
      'UPDATE chat_messages SET is_read=1 WHERE sender_id=? AND receiver_id=? AND is_read=0',
      [other, req.user.id]
    );
    res.json({ messages: msgs });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/chat/:userId — send message
router.post('/:userId', auth, async (req, res) => {
  try {
    const { body, reply_to_id } = req.body;
    if (!body?.trim()) return res.status(400).json({ error: 'Message body required.' });
    const receiver = parseInt(req.params.userId);
    const receiverUser = await db.get2('SELECT id, name FROM users WHERE id=?', [receiver]);
    if (!receiverUser) return res.status(404).json({ error: 'Recipient not found.' });

    const result = await db.exec2(
      'INSERT INTO chat_messages (sender_id, receiver_id, body, reply_to_id) VALUES (?,?,?,?)',
      [req.user.id, receiver, body.trim(), reply_to_id || null]
    );

    // Fetch reply info to return to client
    let reply_body = null, reply_sender_name = null;
    if (reply_to_id) {
      const orig = await db.get2(
        'SELECT cm.body, u.name FROM chat_messages cm JOIN users u ON cm.sender_id=u.id WHERE cm.id=?',
        [reply_to_id]
      );
      reply_body = orig?.body || null;
      reply_sender_name = orig?.name || null;
    }

    const sender = await db.get2('SELECT name FROM users WHERE id=?', [req.user.id]);
    await notify({
      userId: receiver,
      title: `💬 ${sender.name}`,
      body: body.trim().slice(0, 80),
      type: 'message', refId: result.lastID, refType: 'chat',
    });
    res.status(201).json({
      id: result.lastID, sender_id: req.user.id, receiver_id: receiver,
      body: body.trim(), sender_name: sender.name,
      reply_to_id: reply_to_id || null, reply_body, reply_sender_name,
      is_read: 0, is_deleted: 0,
      created_at: new Date().toISOString(),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/chat/:userId/:msgId — unsend (soft delete, own messages only)
router.delete('/:userId/:msgId', auth, async (req, res) => {
  try {
    const msgId = parseInt(req.params.msgId);
    const msg   = await db.get2('SELECT * FROM chat_messages WHERE id=?', [msgId]);
    if (!msg) return res.status(404).json({ error: 'Message not found.' });
    if (msg.sender_id !== req.user.id) return res.status(403).json({ error: 'You can only unsend your own messages.' });
    await db.exec2('UPDATE chat_messages SET is_deleted=1, body=? WHERE id=?', ['', msgId]);
    res.json({ message: 'Message unsent.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/chat/:userId/read — mark all as read (called when chat window opens)
router.put('/:userId/read', auth, async (req, res) => {
  try {
    const other = parseInt(req.params.userId);
    await db.exec2(
      'UPDATE chat_messages SET is_read=1 WHERE sender_id=? AND receiver_id=? AND is_read=0',
      [other, req.user.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
