// Marketia China Admin - Users & Roles screen.
import { apiFetch, requireAdminAuth, renderSidebar, wireLogout, escapeHtml, formatDate } from './adminShell.js';

let admin = null;
let users = [];
let roles = [];
let permissionCategories = [];

function showError(message) {
  const banner = document.getElementById('error-banner');
  if (!banner) return;
  banner.innerHTML = `<div style="background:var(--mc-china-red-light);color:var(--mc-china-red);border:1px solid var(--mc-china-red);border-radius:var(--radius-sm);padding:10px 14px;margin-bottom:16px;font-size:13px;font-weight:600;">${escapeHtml(message)}</div>`;
  window.clearTimeout(showError._t);
  showError._t = window.setTimeout(() => {
    banner.innerHTML = '';
  }, 6000);
}

function statusBadge(isActive) {
  return isActive
    ? `<span class="admin-badge admin-badge-green">Active</span>`
    : `<span class="admin-badge admin-badge-neutral">Disabled</span>`;
}

function roleOptionsHtml(selectedKey) {
  return roles
    .map((r) => `<option value="${escapeHtml(r.key)}" ${r.key === selectedKey ? 'selected' : ''}>${escapeHtml(r.name)}</option>`)
    .join('');
}

/* ---------------- Shell / tabs ---------------- */

function renderShell() {
  document.getElementById('admin-shell').innerHTML = `
    ${renderSidebar('users', admin)}
    <div class="admin-main">
      <div class="admin-topbar">
        <h1>Users &amp; Roles</h1>
      </div>
      <div class="admin-content">
        <div id="error-banner"></div>

        <div style="display:flex;gap:8px;margin-bottom:20px;">
          <button type="button" class="btn-primary" id="tab-team-btn" style="padding:8px 18px;">Team</button>
          <button type="button" class="btn-secondary" id="tab-roles-btn" style="padding:8px 18px;">Roles &amp; Permissions</button>
        </div>

        <div id="team-panel">
          <div class="admin-panel" style="margin-bottom:20px;">
            <div class="admin-panel-header">
              <h2>Add User</h2>
              <button type="button" class="btn-primary" id="toggle-add-user-btn" style="padding:6px 14px;font-size:13px;">+ Add User</button>
            </div>
            <div id="add-user-form-wrap" style="display:none;padding:20px;"></div>
          </div>

          <div class="admin-panel">
            <div class="admin-panel-header">
              <h2>Team</h2>
            </div>
            <div class="admin-table-wrap">
              <table class="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Last Login</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody id="users-tbody">
                  <tr><td colspan="6" class="admin-table-empty">Loading users…</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div id="roles-panel" style="display:none;">
          <div id="roles-list">
            <div class="admin-panel"><div class="admin-table-empty">Loading roles…</div></div>
          </div>

          <div class="admin-panel" style="margin-top:20px;">
            <div class="admin-panel-header">
              <h2>Custom Roles</h2>
              <button type="button" class="btn-primary" id="toggle-create-role-btn" style="padding:6px 14px;font-size:13px;">+ Create Custom Role</button>
            </div>
            <div id="create-role-form-wrap" style="display:none;padding:20px;"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function switchTab(tab) {
  const teamPanel = document.getElementById('team-panel');
  const rolesPanel = document.getElementById('roles-panel');
  const teamBtn = document.getElementById('tab-team-btn');
  const rolesBtn = document.getElementById('tab-roles-btn');
  teamPanel.style.display = tab === 'team' ? '' : 'none';
  rolesPanel.style.display = tab === 'roles' ? '' : 'none';
  teamBtn.className = tab === 'team' ? 'btn-primary' : 'btn-secondary';
  rolesBtn.className = tab === 'roles' ? 'btn-primary' : 'btn-secondary';
}

/* ---------------- Team tab: table ---------------- */

function userRowHtml(u) {
  const id = u.id;
  const lastLogin = u.lastLoginAt
    ? escapeHtml(formatDate(u.lastLoginAt))
    : '<span style="color:var(--text-muted);">Never</span>';

  return `
    <tr data-user-row="${id}">
      <td><strong>${escapeHtml(u.name)}</strong></td>
      <td>${escapeHtml(u.email)}</td>
      <td>${escapeHtml(u.roleName || u.role || '')}</td>
      <td>${statusBadge(u.isActive)}</td>
      <td>${lastLogin}</td>
      <td>
        <div class="admin-row-actions">
          <button type="button" class="btn-secondary user-edit-toggle" data-id="${id}" style="padding:6px 12px;font-size:12px;">Edit</button>
          <button type="button" class="btn-secondary user-toggle-active" data-id="${id}" style="padding:6px 12px;font-size:12px;">${u.isActive ? 'Disable' : 'Enable'}</button>
          <button type="button" class="btn-secondary user-reset-toggle" data-id="${id}" style="padding:6px 12px;font-size:12px;">Reset Password</button>
        </div>
      </td>
    </tr>
    <tr data-user-edit-row="${id}" style="display:none;">
      <td colspan="6" style="background:var(--bg-tertiary);">
        <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end;padding:12px 4px;">
          <div>
            <label class="form-label" for="edit-name-${id}">Name</label>
            <input class="form-input" type="text" id="edit-name-${id}" value="${escapeHtml(u.name)}" style="width:200px;" />
          </div>
          <div>
            <label class="form-label" for="edit-role-${id}">Role</label>
            <select class="form-input" id="edit-role-${id}" style="width:180px;">${roleOptionsHtml(u.role)}</select>
          </div>
          <button type="button" class="btn-primary user-save-edit" data-id="${id}" style="padding:8px 16px;">Save</button>
          <button type="button" class="btn-secondary user-cancel-edit" data-id="${id}" style="padding:8px 16px;">Cancel</button>
          <span id="user-edit-status-${id}" style="font-size:13px;color:var(--text-muted);"></span>
        </div>
      </td>
    </tr>
    <tr data-user-reset-row="${id}" style="display:none;">
      <td colspan="6" style="background:var(--bg-tertiary);">
        <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end;padding:12px 4px;">
          <div>
            <label class="form-label" for="reset-pw-${id}">New Password</label>
            <input class="form-input" type="password" id="reset-pw-${id}" autocomplete="new-password" style="width:200px;" />
          </div>
          <button type="button" class="btn-primary user-save-reset" data-id="${id}" style="padding:8px 16px;">Set Password</button>
          <button type="button" class="btn-secondary user-cancel-reset" data-id="${id}" style="padding:8px 16px;">Cancel</button>
          <span id="user-reset-status-${id}" style="font-size:13px;color:var(--text-muted);"></span>
        </div>
      </td>
    </tr>
  `;
}

function renderUsersTable() {
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;

  if (!users.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="admin-table-empty">No users found.</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(userRowHtml).join('');
  wireUserRowEvents();
}

function wireUserRowEvents() {
  document.querySelectorAll('.user-edit-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const row = document.querySelector(`tr[data-user-edit-row="${id}"]`);
      if (row) row.style.display = row.style.display === 'none' ? '' : 'none';
    });
  });

  document.querySelectorAll('.user-cancel-edit').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const row = document.querySelector(`tr[data-user-edit-row="${id}"]`);
      if (row) row.style.display = 'none';
    });
  });

  document.querySelectorAll('.user-reset-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const row = document.querySelector(`tr[data-user-reset-row="${id}"]`);
      if (row) row.style.display = row.style.display === 'none' ? '' : 'none';
    });
  });

  document.querySelectorAll('.user-cancel-reset').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const row = document.querySelector(`tr[data-user-reset-row="${id}"]`);
      if (row) row.style.display = 'none';
    });
  });

  document.querySelectorAll('.user-toggle-active').forEach((btn) => {
    btn.addEventListener('click', () => handleToggleActive(btn));
  });

  document.querySelectorAll('.user-save-edit').forEach((btn) => {
    btn.addEventListener('click', () => handleSaveEdit(btn));
  });

  document.querySelectorAll('.user-save-reset').forEach((btn) => {
    btn.addEventListener('click', () => handleSaveReset(btn));
  });
}

async function handleToggleActive(btn) {
  const id = btn.getAttribute('data-id');
  const user = users.find((u) => String(u.id) === String(id));
  if (!user) return;

  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = '…';

  try {
    const data = await apiFetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !user.isActive }),
    });
    Object.assign(user, data.user);
    renderUsersTable();
  } catch (err) {
    showError(err.message);
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

async function handleSaveEdit(btn) {
  const id = btn.getAttribute('data-id');
  const nameInput = document.getElementById(`edit-name-${id}`);
  const roleSelect = document.getElementById(`edit-role-${id}`);
  const statusEl = document.getElementById(`user-edit-status-${id}`);

  const name = nameInput.value.trim();
  const role = roleSelect.value;

  if (!name) {
    statusEl.style.color = 'var(--mc-china-red)';
    statusEl.textContent = 'Name is required.';
    return;
  }

  btn.disabled = true;
  statusEl.style.color = 'var(--text-muted)';
  statusEl.textContent = 'Saving…';

  try {
    const data = await apiFetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name, role }),
    });
    const user = users.find((u) => String(u.id) === String(id));
    if (user) Object.assign(user, data.user);
    renderUsersTable();
  } catch (err) {
    statusEl.style.color = 'var(--mc-china-red)';
    statusEl.textContent = err.message;
    btn.disabled = false;
  }
}

async function handleSaveReset(btn) {
  const id = btn.getAttribute('data-id');
  const pwInput = document.getElementById(`reset-pw-${id}`);
  const statusEl = document.getElementById(`user-reset-status-${id}`);
  const newPassword = pwInput.value;

  if (!newPassword || newPassword.length < 8) {
    statusEl.style.color = 'var(--mc-china-red)';
    statusEl.textContent = 'Password must be at least 8 characters.';
    return;
  }

  btn.disabled = true;
  statusEl.style.color = 'var(--text-muted)';
  statusEl.textContent = 'Saving…';

  try {
    await apiFetch(`/api/admin/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    });
    statusEl.style.color = 'var(--text-muted)';
    statusEl.textContent = 'Password updated.';
    pwInput.value = '';
  } catch (err) {
    statusEl.style.color = 'var(--mc-china-red)';
    statusEl.textContent = err.message;
  } finally {
    btn.disabled = false;
  }
}

/* ---------------- Team tab: add user ---------------- */

function addUserFormHtml() {
  return `
    <div style="display:flex;flex-direction:column;gap:14px;max-width:420px;">
      <div>
        <label class="form-label" for="new-user-name">Name</label>
        <input class="form-input" type="text" id="new-user-name" />
      </div>
      <div>
        <label class="form-label" for="new-user-email">Email</label>
        <input class="form-input" type="email" id="new-user-email" />
      </div>
      <div>
        <label class="form-label" for="new-user-password">Password</label>
        <input class="form-input" type="password" id="new-user-password" autocomplete="new-password" />
      </div>
      <div>
        <label class="form-label" for="new-user-role">Role</label>
        <select class="form-input" id="new-user-role">${roleOptionsHtml(roles[0] ? roles[0].key : '')}</select>
      </div>
      <div style="display:flex;align-items:center;gap:14px;">
        <button type="button" class="btn-primary" id="submit-add-user-btn">Create User</button>
        <span id="add-user-status" style="font-size:13px;color:var(--text-muted);"></span>
      </div>
    </div>
  `;
}

function wireAddUserForm() {
  const toggleBtn = document.getElementById('toggle-add-user-btn');
  const wrap = document.getElementById('add-user-form-wrap');

  toggleBtn.addEventListener('click', () => {
    if (wrap.style.display === 'none') {
      wrap.innerHTML = addUserFormHtml();
      wrap.style.display = '';
      document.getElementById('submit-add-user-btn').addEventListener('click', handleAddUser);
    } else {
      wrap.style.display = 'none';
      wrap.innerHTML = '';
    }
  });
}

async function handleAddUser() {
  const btn = document.getElementById('submit-add-user-btn');
  const statusEl = document.getElementById('add-user-status');

  const name = document.getElementById('new-user-name').value.trim();
  const email = document.getElementById('new-user-email').value.trim();
  const password = document.getElementById('new-user-password').value;
  const role = document.getElementById('new-user-role').value;

  if (!name || !email || !password || !role) {
    statusEl.style.color = 'var(--mc-china-red)';
    statusEl.textContent = 'All fields are required.';
    return;
  }
  if (password.length < 8) {
    statusEl.style.color = 'var(--mc-china-red)';
    statusEl.textContent = 'Password must be at least 8 characters.';
    return;
  }

  btn.disabled = true;
  statusEl.style.color = 'var(--text-muted)';
  statusEl.textContent = 'Creating…';

  try {
    const data = await apiFetch('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, role }),
    });
    users.push(data.user);
    renderUsersTable();
    statusEl.style.color = 'var(--text-muted)';
    statusEl.textContent = 'User created.';
    document.getElementById('new-user-name').value = '';
    document.getElementById('new-user-email').value = '';
    document.getElementById('new-user-password').value = '';
  } catch (err) {
    statusEl.style.color = 'var(--mc-china-red)';
    statusEl.textContent = err.message;
  } finally {
    btn.disabled = false;
  }
}

async function loadUsers() {
  try {
    const data = await apiFetch('/api/admin/users');
    users = data.users || [];
    renderUsersTable();
  } catch (err) {
    showError(err.message);
    const tbody = document.getElementById('users-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="admin-table-empty">Failed to load users.</td></tr>`;
  }
}

/* ---------------- Roles & Permissions tab ---------------- */

function permissionsGridHtml(idPrefix, checkedKeys) {
  const checkedSet = new Set(checkedKeys || []);
  return permissionCategories
    .map(
      (cat) => `
      <div style="margin-bottom:16px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-muted);margin-bottom:8px;">${escapeHtml(cat.category)}</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px;">
          ${cat.permissions
            .map(
              (p) => `
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text-secondary);font-weight:400;">
              <input type="checkbox" data-perm-checkbox value="${escapeHtml(p.key)}" id="${idPrefix}-perm-${escapeHtml(p.key)}" ${checkedSet.has(p.key) ? 'checked' : ''} />
              ${escapeHtml(p.label)}
            </label>
          `
            )
            .join('')}
        </div>
      </div>
    `
    )
    .join('');
}

function roleCardHtml(role) {
  const id = role.id;
  const nameField = role.isSystem
    ? `<div style="font-size:15px;font-weight:800;">${escapeHtml(role.name)} <span class="admin-badge admin-badge-neutral" style="margin-left:8px;">System</span></div>`
    : `<div>
        <label class="form-label" for="role-name-${id}">Role Name</label>
        <input class="form-input" type="text" id="role-name-${id}" value="${escapeHtml(role.name)}" style="max-width:280px;" />
      </div>`;

  return `
    <div class="admin-panel" style="margin-bottom:20px;" id="role-panel-${id}">
      <div class="admin-panel-header">
        ${nameField}
        <span style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;">${escapeHtml(role.key)}</span>
      </div>
      <div style="padding:20px;">
        ${permissionsGridHtml(`role-${id}`, role.permissions)}
        <div style="display:flex;align-items:center;gap:14px;margin-top:8px;">
          <button type="button" class="btn-primary role-save-btn" data-id="${id}">Save Changes</button>
          <span id="role-save-status-${id}" style="font-size:13px;color:var(--text-muted);"></span>
        </div>
      </div>
    </div>
  `;
}

function renderRolesList() {
  const wrap = document.getElementById('roles-list');
  if (!wrap) return;

  if (!roles.length) {
    wrap.innerHTML = `<div class="admin-panel"><div class="admin-table-empty">No roles found.</div></div>`;
    return;
  }

  wrap.innerHTML = roles.map(roleCardHtml).join('');
  wrap.querySelectorAll('.role-save-btn').forEach((btn) => {
    btn.addEventListener('click', () => handleSaveRole(btn));
  });
}

async function handleSaveRole(btn) {
  const id = btn.getAttribute('data-id');
  const role = roles.find((r) => String(r.id) === String(id));
  if (!role) return;

  const statusEl = document.getElementById(`role-save-status-${id}`);
  const panel = document.getElementById(`role-panel-${id}`);
  const permissions = Array.from(panel.querySelectorAll('[data-perm-checkbox]:checked')).map((cb) => cb.value);

  const payload = { permissions };
  if (!role.isSystem) {
    const nameInput = document.getElementById(`role-name-${id}`);
    const name = nameInput.value.trim();
    if (!name) {
      statusEl.style.color = 'var(--mc-china-red)';
      statusEl.textContent = 'Role name is required.';
      return;
    }
    payload.name = name;
  }

  btn.disabled = true;
  statusEl.style.color = 'var(--text-muted)';
  statusEl.textContent = 'Saving…';

  try {
    const data = await apiFetch(`/api/admin/roles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    Object.assign(role, data.role);
    statusEl.style.color = 'var(--text-muted)';
    statusEl.textContent = 'Saved.';
  } catch (err) {
    statusEl.style.color = 'var(--mc-china-red)';
    statusEl.textContent = err.message;
  } finally {
    btn.disabled = false;
  }
}

function createRoleFormHtml() {
  return `
    <div style="display:flex;flex-direction:column;gap:14px;max-width:640px;">
      <div style="display:flex;gap:14px;flex-wrap:wrap;">
        <div>
          <label class="form-label" for="new-role-key">Key (lowercase_snake_case)</label>
          <input class="form-input" type="text" id="new-role-key" placeholder="e.g. inventory_manager" style="width:240px;" />
        </div>
        <div>
          <label class="form-label" for="new-role-name">Name</label>
          <input class="form-input" type="text" id="new-role-name" placeholder="e.g. Inventory Manager" style="width:240px;" />
        </div>
      </div>
      <div id="new-role-perms">${permissionsGridHtml('new-role', [])}</div>
      <div style="display:flex;align-items:center;gap:14px;">
        <button type="button" class="btn-primary" id="submit-create-role-btn">Create Role</button>
        <span id="create-role-status" style="font-size:13px;color:var(--text-muted);"></span>
      </div>
    </div>
  `;
}

function wireCreateRoleForm() {
  const toggleBtn = document.getElementById('toggle-create-role-btn');
  const wrap = document.getElementById('create-role-form-wrap');

  toggleBtn.addEventListener('click', () => {
    if (wrap.style.display === 'none') {
      wrap.innerHTML = createRoleFormHtml();
      wrap.style.display = '';
      document.getElementById('submit-create-role-btn').addEventListener('click', handleCreateRole);
    } else {
      wrap.style.display = 'none';
      wrap.innerHTML = '';
    }
  });
}

async function handleCreateRole() {
  const btn = document.getElementById('submit-create-role-btn');
  const statusEl = document.getElementById('create-role-status');

  const key = document.getElementById('new-role-key').value.trim();
  const name = document.getElementById('new-role-name').value.trim();
  const permissions = Array.from(document.querySelectorAll('#new-role-perms [data-perm-checkbox]:checked')).map((cb) => cb.value);

  if (!/^[a-z][a-z0-9_]*$/.test(key)) {
    statusEl.style.color = 'var(--mc-china-red)';
    statusEl.textContent = 'Key must be lowercase snake_case (e.g. inventory_manager).';
    return;
  }
  if (!name) {
    statusEl.style.color = 'var(--mc-china-red)';
    statusEl.textContent = 'Name is required.';
    return;
  }

  btn.disabled = true;
  statusEl.style.color = 'var(--text-muted)';
  statusEl.textContent = 'Creating…';

  try {
    const data = await apiFetch('/api/admin/roles', {
      method: 'POST',
      body: JSON.stringify({ key, name, permissions }),
    });
    roles.push(data.role);
    renderRolesList();
    document.getElementById('create-role-form-wrap').style.display = 'none';
    document.getElementById('create-role-form-wrap').innerHTML = '';
    renderUsersTable();
  } catch (err) {
    statusEl.style.color = 'var(--mc-china-red)';
    statusEl.textContent = err.message;
    btn.disabled = false;
  }
}

async function loadRolesAndCatalog() {
  try {
    const [rolesData, catalogData] = await Promise.all([
      apiFetch('/api/admin/roles'),
      apiFetch('/api/admin/roles/permissions-catalog'),
    ]);
    roles = rolesData.roles || [];
    permissionCategories = catalogData.categories || [];
    renderRolesList();
  } catch (err) {
    showError(err.message);
    const wrap = document.getElementById('roles-list');
    if (wrap) wrap.innerHTML = `<div class="admin-panel"><div class="admin-table-empty">Failed to load roles.</div></div>`;
  }
}

/* ---------------- Init ---------------- */

async function init() {
  admin = await requireAdminAuth();
  if (!admin) return;

  renderShell();
  wireLogout();
  switchTab('team');

  document.getElementById('tab-team-btn').addEventListener('click', () => switchTab('team'));
  document.getElementById('tab-roles-btn').addEventListener('click', () => switchTab('roles'));

  wireAddUserForm();
  wireCreateRoleForm();

  // Roles must load before users so the per-row role <select> options are populated.
  await loadRolesAndCatalog();
  await loadUsers();
}

init();
