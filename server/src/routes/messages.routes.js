const express = require('express');
const { db } = require('../db');
const { createNotification } = require('../lib/notify');

const router = express.Router();

const VALID_TYPES = ['sourcing', 'contact', 'service_inquiry'];

router.post('/', (req, res) => {
  const { type, name, email, phone, subject, body, meta } = req.body || {};

  const messageType = VALID_TYPES.includes(type) ? type : 'sourcing';

  if (!name) {
    return res.status(400).json({ error: 'Name is required.' });
  }

  const metaJson = meta !== undefined && meta !== null ? JSON.stringify(meta) : null;

  const result = db
    .prepare(
      `INSERT INTO messages (type, name, email, phone, subject, body, meta) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(messageType, name, email || null, phone || null, subject || null, body || null, metaJson);

  const leadSource = messageType === 'sourcing' ? 'sourcing_inquiry' : 'contact_message';

  db.prepare(`INSERT INTO leads (email, phone, name, source, source_ref_id) VALUES (?, ?, ?, ?, ?)`).run(
    email || null,
    phone || null,
    name,
    leadSource,
    result.lastInsertRowid
  );

  createNotification({
    type: 'message.new',
    title: 'New customer message',
    body: `${name}: ${subject || '(no subject)'}`,
    relatedType: 'message',
    relatedId: result.lastInsertRowid,
  });

  res.status(201).json({ ok: true });
});

module.exports = router;
