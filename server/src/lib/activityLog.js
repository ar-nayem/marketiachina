const { db } = require('../db');

function logActivity({ adminId, adminName, action, targetType = null, targetId = null, before = null, after = null, ip = null }) {
  try {
    db.prepare(
      `INSERT INTO activity_logs (admin_id, admin_name_snapshot, action, target_type, target_id, before_value, after_value, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      adminId != null ? adminId : null,
      adminName != null ? adminName : null,
      action,
      targetType,
      targetId,
      before != null ? JSON.stringify(before) : null,
      after != null ? JSON.stringify(after) : null,
      ip
    );
  } catch (err) {
    console.error('[activityLog] failed to record activity:', err);
  }
}

module.exports = { logActivity };
