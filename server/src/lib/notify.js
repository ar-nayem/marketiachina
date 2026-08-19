const { db } = require('../db');

// Broadcast-style, best-effort notification insert. Every admin sees every
// notification (no target_admin_id column - fine for a small team). This must
// never throw into the caller: a notification failing to record must never
// break the real action that triggered it (a new order, a new review, etc.),
// mirroring activityLog.js's own defensive philosophy.
function createNotification({ type, title, body = null, relatedType = null, relatedId = null }) {
  try {
    db.prepare(
      `INSERT INTO notifications (type, title, body, related_type, related_id)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      type,
      title,
      body != null ? body : null,
      relatedType != null ? relatedType : null,
      // related_id is a TEXT column, but callers often pass a raw
      // lastInsertRowid (a JS number) - node:sqlite binds plain numbers as
      // SQLite REAL, which a TEXT-affinity column then stores as "2.0"
      // instead of "2". Stringify explicitly so it's always a clean id.
      relatedId != null ? String(relatedId) : null
    );
  } catch (err) {
    console.error('[notify] failed to record notification:', err);
  }
}

function getUnreadCount() {
  try {
    const row = db.prepare('SELECT COUNT(*) c FROM notifications WHERE is_read = 0').get();
    return row ? row.c : 0;
  } catch (err) {
    console.error('[notify] failed to get unread count:', err);
    return 0;
  }
}

module.exports = { createNotification, getUnreadCount };
