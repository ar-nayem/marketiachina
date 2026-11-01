const DAY_MS = 24 * 60 * 60 * 1000;

export function formatPurgeCountdown(purgeAt, now = new Date()) {
  if (!purgeAt) return 'Pending deletion';
  const deadline = new Date(`${purgeAt.replace(' ', 'T')}Z`);
  if (Number.isNaN(deadline.getTime())) return 'Pending deletion';
  const days = Math.ceil((deadline.getTime() - now.getTime()) / DAY_MS);
  if (days <= 0) return 'Deletes today';
  if (days === 1) return '1 day remaining';
  return `${days} days remaining`;
}

export function isProductTrashed(product) {
  return product?.status === 'archived' && Boolean(product.deletedAt);
}
