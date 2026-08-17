const PERMISSIONS = [
  { key: 'orders.view', label: 'View orders', category: 'Orders' },
  { key: 'orders.update_status', label: 'Update order status', category: 'Orders' },
  { key: 'products.view', label: 'View products', category: 'Products' },
  { key: 'products.create', label: 'Create products', category: 'Products' },
  { key: 'products.edit', label: 'Edit products', category: 'Products' },
  { key: 'products.delete', label: 'Delete/archive products', category: 'Products' },
  { key: 'customers.view', label: 'View customers', category: 'Customers' },
  { key: 'customers.message', label: 'Message customers', category: 'Customers' },
  { key: 'messages.view', label: 'View messages', category: 'Messages' },
  { key: 'messages.reply', label: 'Reply to messages', category: 'Messages' },
  { key: 'reviews.manage', label: 'Moderate reviews', category: 'Reviews' },
  { key: 'users.manage', label: 'Manage admin & moderator accounts', category: 'Users' },
  { key: 'roles.manage', label: 'Manage roles & permissions', category: 'Users' },
  { key: 'settings.manage', label: 'Manage site settings', category: 'Settings' },
  { key: 'activity_logs.view', label: 'View activity logs', category: 'System' },
];

const DEFAULT_ROLE_PERMISSIONS = {
  admin: PERMISSIONS.map((p) => p.key),
  moderator: ['orders.view', 'orders.update_status', 'customers.view', 'customers.message', 'messages.view', 'messages.reply', 'reviews.manage', 'activity_logs.view'],
};

module.exports = { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS };
