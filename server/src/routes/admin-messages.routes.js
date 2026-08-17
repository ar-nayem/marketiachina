const express = require('express');
const { db } = require('../db');
const { requirePermission } = require('../middleware/requirePermission');
const { logActivity } = require('../lib/activityLog');

const router = express.Router();

function toCamelMessage(row) {
  let meta = null;
  if (row.meta) {
    try {
      meta = JSON.parse(row.meta);
    } catch (err) {
      meta = row.meta;
    }
  }

  return {
    id: row.id,
    type: row.type,
    customerId: row.customer_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    subject: row.subject,
    body: row.body,
    meta,
    status: row.status,
    adminReply: row.admin_reply,
    repliedAt: row.replied_at,
    createdAt: row.created_at,
  };
}

router.get('/', requirePermission('messages.view'), (req, res) => {
  const rows = db.prepare(`SELECT * FROM messages ORDER BY created_at DESC, id DESC`).all();
  res.json({ messages: rows.map(toCamelMessage) });
});

router.patch('/:id/reply', requirePermission('messages.reply'), (req, res) => {
  const { id } = req.params;
  const { reply } = req.body || {};

  if (!reply) {
    return res.status(400).json({ error: 'Reply text is required.' });
  }

  const message = db.prepare(`SELECT id FROM messages WHERE id = ?`).get(id);
  if (!message) return res.status(404).json({ error: 'Message not found.' });

  db.prepare(
    `UPDATE messages SET admin_reply = ?, replied_at = datetime('now'), status = 'replied' WHERE id = ?`
  ).run(reply, id);

  logActivity({
    adminId: req.admin.id,
    adminName: req.admin.name,
    action: 'message.replied',
    targetType: 'message',
    targetId: id,
    ip: req.ip
  });

  res.json({ ok: true });
});

module.exports = router;
