const express = require('express');
const { db } = require('../db');
const { requireAdmin } = require('../middleware/requireAdmin');

const router = express.Router();

// Auth note: every route below uses requireAdmin (any authenticated admin or
// moderator), not requirePermission. Notifications are a broadcast-to-all-
// admins, read-only informational feed - there is no permission in
// server/src/lib/permissions.js that every role holds, and viewing/dismissing
// your own notification feed is not a privilege-differentiated action (unlike
// e.g. returns.manage or messages.reply, which gate real business-data
// mutations). This mirrors how admin-auth.routes.js already uses the same
// lighter requireAdmin check for its own low-stakes /me-style endpoints.

function toAdminNotification(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    relatedType: row.related_type,
    relatedId: row.related_id,
    isRead: !!row.is_read,
    createdAt: row.created_at,
  };
}

// GET / - most recent notifications (newest first), capped at 50, plus the
// current unread count. This is a lightweight feed for the bell dropdown,
// not a full paginated archive browser.
router.get('/', requireAdmin, (req, res) => {
  const rows = db
    .prepare(`SELECT * FROM notifications ORDER BY created_at DESC, id DESC LIMIT 50`)
    .all();
  const unreadRow = db.prepare(`SELECT COUNT(*) c FROM notifications WHERE is_read = 0`).get();

  res.json({
    notifications: rows.map(toAdminNotification),
    unreadCount: unreadRow ? unreadRow.c : 0,
  });
});

// PATCH /:id/read - mark a single notification read.
router.patch('/:id/read', requireAdmin, (req, res) => {
  const existing = db.prepare(`SELECT id FROM notifications WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Notification not found.' });

  db.prepare(`UPDATE notifications SET is_read = 1 WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

// POST /mark-all-read - mark every currently-unread notification read.
router.post('/mark-all-read', requireAdmin, (req, res) => {
  const result = db.prepare(`UPDATE notifications SET is_read = 1 WHERE is_read = 0`).run();
  res.json({ ok: true, updatedCount: result.changes });
});

module.exports = router;
