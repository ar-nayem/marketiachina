const { purgeExpiredProducts } = require('./productRetention');

const DAY_MS = 24 * 60 * 60 * 1000;

function startProductPurgeScheduler({
  db,
  uploadsRoot,
  intervalMs = DAY_MS,
  now = () => new Date().toISOString(),
  logActivity,
  schedule = true,
}) {
  const writeActivity = logActivity || require('./activityLog').logActivity;

  function runNow() {
    const results = purgeExpiredProducts(db, { uploadsRoot, now: now() });
    for (const result of results) {
      if (!result.purged) {
        if (result.error) console.error(`[productPurgeScheduler] ${result.productId}: ${result.error}`);
        continue;
      }
      writeActivity({
        adminId: null,
        adminName: 'System',
        action: 'product.auto_purged',
        targetType: 'product',
        targetId: result.productId,
        before: { name: result.productName },
      });
    }
    return results;
  }

  runNow();
  const timer = schedule ? setInterval(runNow, intervalMs) : null;
  timer?.unref?.();

  return {
    runNow,
    stop() {
      if (timer) clearInterval(timer);
    },
  };
}

module.exports = { startProductPurgeScheduler };
