// utils/activityLogger.js — log teacher actions
const db = require('../db');

async function logActivity(actorId, action, entity = null, entityId = null, detail = null) {
  try {
    await db.exec2(
      'INSERT INTO activity_log (actor_id, action, entity, entity_id, detail) VALUES (?,?,?,?,?)',
      [actorId, action, entity, entityId, detail]
    );
  } catch (e) { /* non-critical, swallow */ }
}

module.exports = { logActivity };
