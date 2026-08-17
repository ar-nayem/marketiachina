const express = require('express');
const { db } = require('../db');
const { requirePermission } = require('../middleware/requirePermission');

const router = express.Router();

router.use(requirePermission('activity_logs.view'));

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM activity_logs ORDER BY created_at DESC, id DESC LIMIT 300').all();
  res.json({
    logs: rows.map((r) => ({
      id: r.id,
      adminName: r.admin_name_snapshot,
      action: r.action,
      targetType: r.target_type,
      targetId: r.target_id,
      before: r.before_value ? JSON.parse(r.before_value) : null,
      after: r.after_value ? JSON.parse(r.after_value) : null,
      createdAt: r.created_at,
    })),
  });
});

module.exports = router;
