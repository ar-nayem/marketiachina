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
  const rows = db
    .prepare(
      `SELECT messages.*,
              (SELECT COUNT(*) FROM message_replies WHERE message_replies.message_id = messages.id) AS reply_count,
              (SELECT COUNT(*) FROM message_notes WHERE message_notes.message_id = messages.id) AS note_count
       FROM messages
       ORDER BY created_at DESC, id DESC`
    )
    .all();
  res.json({
    messages: rows.map((row) => ({
      ...toCamelMessage(row),
      replyCount: row.reply_count,
      noteCount: row.note_count,
    })),
  });
});

router.get('/:id', requirePermission('messages.view'), (req, res) => {
  const { id } = req.params;

  const message = db.prepare(`SELECT * FROM messages WHERE id = ?`).get(id);
  if (!message) return res.status(404).json({ error: 'Message not found.' });

  const replies = db
    .prepare(`SELECT * FROM message_replies WHERE message_id = ? ORDER BY created_at ASC, id ASC`)
    .all(id)
    .map((r) => ({
      id: r.id,
      senderType: r.sender_type,
      body: r.body,
      adminName: r.admin_name,
      createdAt: r.created_at,
    }));

  const notes = db
    .prepare(`SELECT * FROM message_notes WHERE message_id = ? ORDER BY created_at DESC, id DESC`)
    .all(id)
    .map((n) => ({
      id: n.id,
      note: n.note,
      adminName: n.admin_name,
      createdAt: n.created_at,
    }));

  res.json({ message: toCamelMessage(message), replies, notes });
});

router.post('/:id/reply', requirePermission('messages.reply'), (req, res) => {
  const { id } = req.params;
  const { body } = req.body || {};

  if (typeof body !== 'string' || !body.trim()) {
    return res.status(400).json({ error: 'Reply body is required.' });
  }

  const message = db.prepare(`SELECT id FROM messages WHERE id = ?`).get(id);
  if (!message) return res.status(404).json({ error: 'Message not found.' });

  let result;
  db.exec('BEGIN');
  try {
    result = db
      .prepare(
        `INSERT INTO message_replies (message_id, sender_type, body, admin_id, admin_name)
         VALUES (?, 'admin', ?, ?, ?)`
      )
      .run(id, body, req.admin.id, req.admin.name);

    db.prepare(`UPDATE messages SET replied_at = datetime('now'), status = 'replied' WHERE id = ?`).run(id);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  const created = db.prepare(`SELECT * FROM message_replies WHERE id = ?`).get(result.lastInsertRowid);

  logActivity({
    adminId: req.admin.id,
    adminName: req.admin.name,
    action: 'message.replied',
    targetType: 'message',
    targetId: id,
    after: { body },
    ip: req.ip
  });

  res.status(201).json({
    reply: {
      id: created.id,
      senderType: 'admin',
      body: created.body,
      adminName: req.admin.name,
      createdAt: created.created_at,
    },
  });
});

router.post('/:id/notes', requirePermission('messages.reply'), (req, res) => {
  const { id } = req.params;
  const { note } = req.body || {};

  if (typeof note !== 'string' || !note.trim()) {
    return res.status(400).json({ error: 'Note text is required.' });
  }

  const message = db.prepare(`SELECT id FROM messages WHERE id = ?`).get(id);
  if (!message) return res.status(404).json({ error: 'Message not found.' });

  const result = db
    .prepare(
      `INSERT INTO message_notes (message_id, note, admin_id, admin_name)
       VALUES (?, ?, ?, ?)`
    )
    .run(id, note, req.admin.id, req.admin.name);

  const created = db.prepare(`SELECT * FROM message_notes WHERE id = ?`).get(result.lastInsertRowid);

  logActivity({
    adminId: req.admin.id,
    adminName: req.admin.name,
    action: 'message.note_added',
    targetType: 'message',
    targetId: id,
    after: { note },
    ip: req.ip
  });

  res.status(201).json({
    note: {
      id: created.id,
      note: created.note,
      adminName: req.admin.name,
      createdAt: created.created_at,
    },
  });
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
