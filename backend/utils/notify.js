// utils/notify.js — Firebase FCM + in-app + SSE real-time notifications
const db = require('../db');
const path = require('path');

let firebaseAdmin = null;
try {
  if (process.env.FIREBASE_ENABLED === 'true') {
    const admin = require('firebase-admin');
    const serviceAccount = require(path.join(__dirname, '../firebase-service-account.json'));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    firebaseAdmin = admin;
    console.log('✅ Firebase Admin initialized');
  }
} catch (e) {
  console.log('⚠️  Firebase not configured — push notifications disabled');
}

async function notify({ userId, title, body, type = 'general', refId = null, refType = null }) {
  try {
    await db.exec2(
      'INSERT INTO notifications (user_id, title, body, type, ref_id, ref_type) VALUES (?,?,?,?,?,?)',
      [userId, title, body, type, refId, refType]
    );

    // Push SSE event to connected browser tab
    try {
      const app = global.__app;
      if (app?.locals?.sseClients) {
        const clientRes = app.locals.sseClients.get(userId);
        if (clientRes) {
          clientRes.write(`data: ${JSON.stringify({ title, body, type, refId, refType })}\n\n`);
        }
      }
    } catch (sseErr) { /* non-critical */ }

    // Send FCM push if Firebase enabled
    if (firebaseAdmin) {
      const user = await db.get2('SELECT fcm_token FROM users WHERE id = ?', [userId]);
      if (user?.fcm_token) {
        await firebaseAdmin.messaging().send({
          token: user.fcm_token,
          notification: { title, body },
          data: { type, refId: String(refId || ''), refType: refType || '' },
          android: { priority: 'high' },
          apns: { payload: { aps: { sound: 'default', badge: 1 } } },
        });
      }
    }
  } catch (e) {
    console.error('Notify error:', e.message);
  }
}

async function notifyMany(userIds, payload) {
  await Promise.allSettled(userIds.map(uid => notify({ userId: uid, ...payload })));
}

async function notifyClass(cls, section, payload) {
  try {
    let q = "SELECT id FROM users WHERE role='student' AND class=?";
    const params = [cls];
    if (section) { q += ' AND section=?'; params.push(section); }
    const students = await db.all2(q, params);
    await notifyMany(students.map(s => s.id), payload);
  } catch (e) { console.error('notifyClass error:', e.message); }
}

module.exports = { notify, notifyMany, notifyClass };
