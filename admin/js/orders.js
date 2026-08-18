// Marketia China Admin - Orders screen.
import { apiFetch, requireAdminAuth, renderSidebar, wireLogout, escapeHtml, formatDate } from './adminShell.js';

const STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

const STATUS_BADGE_CLASS = {
  pending: 'admin-badge-neutral',
  confirmed: 'admin-badge-gold',
  shipped: 'admin-badge-gold',
  delivered: 'admin-badge-green',
  cancelled: 'admin-badge-red',
};

let admin = null;
let allOrders = [];
let currentFilter = 'all';
let activeOrder = null;

// Some API responses may be snake_case (raw db row) or camelCase (mapped) —
// read defensively so this page works either way per the contract note.
function pick(obj, ...keys) {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
  }
  return '';
}

function money(value) {
  const n = Number(value) || 0;
  return `৳${n.toLocaleString('en-US')}`;
}

function statusLabel(status) {
  if (!status) return '';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusBadge(status) {
  const cls = STATUS_BADGE_CLASS[status] || 'admin-badge-neutral';
  return `<span class="admin-badge ${cls}">${escapeHtml(statusLabel(status))}</span>`;
}

function showError(message) {
  const banner = document.getElementById('error-banner');
  if (!banner) return;
  banner.innerHTML = `<div style="background:var(--mc-china-red-light);color:var(--mc-china-red);border:1px solid var(--mc-china-red);border-radius:var(--radius-sm);padding:10px 14px;margin-bottom:16px;font-size:13px;font-weight:600;">${escapeHtml(message)}</div>`;
  window.clearTimeout(showError._t);
  showError._t = window.setTimeout(() => {
    banner.innerHTML = '';
  }, 6000);
}

function renderShell() {
  document.getElementById('admin-shell').innerHTML = `
    ${renderSidebar('orders', admin)}
    <div class="admin-main">
      <div class="admin-topbar">
        <h1>Orders</h1>
      </div>
      <div class="admin-content">
        <div id="error-banner"></div>
        <div class="admin-panel">
          <div class="admin-panel-header">
            <h2>All Orders</h2>
            <select id="status-filter" class="form-input" style="width:auto;">
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="orders-tbody">
                <tr><td colspan="6" class="admin-table-empty">Loading orders…</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <div class="modal-overlay" id="order-overlay">
      <div class="admin-slideover" id="order-slideover">
        <div class="admin-slideover-header">
          <h2 id="order-slideover-title">Order</h2>
          <button class="admin-icon-btn" id="order-slideover-close" type="button" aria-label="Close">&times;</button>
        </div>
        <div class="admin-slideover-body" id="order-slideover-body"></div>
        <div class="admin-slideover-footer" id="order-slideover-footer"></div>
      </div>
    </div>
  `;
}

function renderTable() {
  const tbody = document.getElementById('orders-tbody');
  if (!tbody) return;

  const list = currentFilter === 'all' ? allOrders : allOrders.filter((o) => o.status === currentFilter);

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="admin-table-empty">No orders found.</td></tr>`;
    return;
  }

  tbody.innerHTML = list
    .map(
      (o) => `
        <tr data-order-row="${o.id}">
          <td><strong>${escapeHtml(o.orderNumber)}</strong></td>
          <td>
            ${escapeHtml(o.customerName)}
            <div style="color:var(--text-muted);font-size:11px;">${escapeHtml(o.customerEmail)}</div>
          </td>
          <td>${money(o.totalBdt)}</td>
          <td>${statusBadge(o.status)}</td>
          <td>${escapeHtml(formatDate(o.createdAt))}</td>
          <td>
            <div class="admin-row-actions">
              <button type="button" class="btn-secondary view-order-btn" data-id="${o.id}" style="padding:6px 12px;font-size:12px;">View</button>
            </div>
          </td>
        </tr>
      `
    )
    .join('');

  tbody.querySelectorAll('.view-order-btn').forEach((btn) => {
    btn.addEventListener('click', () => openOrder(btn.getAttribute('data-id')));
  });
}

function updateOrderRow(order) {
  const row = document.querySelector(`tr[data-order-row="${order.id}"]`);
  if (!row) return;
  const statusCell = row.children[3];
  if (statusCell) statusCell.innerHTML = statusBadge(order.status);
}

async function loadOrders() {
  try {
    const data = await apiFetch('/api/admin/orders');
    allOrders = data.orders || [];
    renderTable();
  } catch (err) {
    showError(err.message);
    const tbody = document.getElementById('orders-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="admin-table-empty">Failed to load orders.</td></tr>`;
  }
}

function renderOrderDetail() {
  const o = activeOrder;
  if (!o) return;

  const orderNumber = pick(o, 'orderNumber', 'order_number');
  const customerName = pick(o, 'customerName', 'customer_name');
  const customerPhone = pick(o, 'customerPhone', 'customer_phone');
  const customerEmail = pick(o, 'customerEmail', 'customer_email');
  const shippingAddress = pick(o, 'shippingAddress', 'shipping_address');
  const paymentMethod = pick(o, 'paymentMethod', 'payment_method');
  const shippingMethod = pick(o, 'shippingMethod', 'shipping_method');
  const subtotal = pick(o, 'subtotalBdt', 'subtotal_bdt');
  const shippingFee = pick(o, 'shippingFeeBdt', 'shipping_fee_bdt');
  const total = pick(o, 'totalBdt', 'total_bdt');
  const status = pick(o, 'status') || 'pending';
  const items = o.items || [];
  const history = Array.isArray(o.history) ? o.history : [];

  document.getElementById('order-slideover-title').textContent = `Order ${orderNumber}`;

  const historyRows = history.length
    ? history
        .map((h) => {
          const note = pick(h, 'note');
          const adminName = pick(h, 'adminName') || 'System';
          const createdAt = pick(h, 'createdAt');
          return `
            <div style="padding:8px 0;border-bottom:1px solid var(--border-color);">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                ${statusBadge(h.status)}
                <span style="color:var(--text-muted);font-size:11px;">${escapeHtml(formatDate(createdAt))}</span>
              </div>
              ${note ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">${escapeHtml(note)}</div>` : ''}
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">by ${escapeHtml(adminName)}</div>
            </div>
          `;
        })
        .join('')
    : '';

  const itemRows = items.length
    ? items
        .map((it) => {
          const name = pick(it, 'productNameSnapshot', 'productName', 'product_name_snapshot');
          const qty = pick(it, 'quantity');
          const unit = pick(it, 'unitPriceBdt', 'unit_price_bdt');
          const lineTotal = pick(it, 'lineTotalBdt', 'line_total_bdt');
          return `
            <tr>
              <td>${escapeHtml(name)}</td>
              <td>${escapeHtml(String(qty))}</td>
              <td>${money(unit)}</td>
              <td>${money(lineTotal)}</td>
            </tr>
          `;
        })
        .join('')
    : `<tr><td colspan="4" class="admin-table-empty">No items.</td></tr>`;

  document.getElementById('order-slideover-body').innerHTML = `
    <div>
      <div class="form-label">Customer</div>
      <div style="font-weight:700;">${escapeHtml(customerName)}</div>
      <div style="color:var(--text-secondary);font-size:13px;margin-top:2px;">${escapeHtml(customerPhone)} &middot; ${escapeHtml(customerEmail)}</div>
      <div style="color:var(--text-secondary);font-size:13px;margin-top:6px;">${escapeHtml(shippingAddress)}</div>
    </div>

    <div style="display:flex;gap:24px;">
      <div>
        <div class="form-label">Payment method</div>
        <div style="text-transform:uppercase;font-weight:600;font-size:13px;">${escapeHtml(paymentMethod)}</div>
      </div>
      <div>
        <div class="form-label">Shipping method</div>
        <div style="text-transform:uppercase;font-weight:600;font-size:13px;">${escapeHtml(shippingMethod)}</div>
      </div>
    </div>

    <div>
      <div class="form-label">Items</div>
      <div class="admin-table-wrap" style="border:1px solid var(--border-color);border-radius:var(--radius-sm);">
        <table class="admin-table">
          <thead><tr><th>Product</th><th>Qty</th><th>Unit</th><th>Line total</th></tr></thead>
          <tbody>${itemRows}</tbody>
        </table>
      </div>
    </div>

    <div>
      <div class="form-label">Status Timeline</div>
      ${history.length
        ? `<div style="border-top:1px solid var(--border-color);">${historyRows}</div>`
        : ''}
    </div>

    <div style="border-top:1px solid var(--border-color);padding-top:12px;font-size:13px;display:flex;flex-direction:column;gap:6px;">
      <div style="display:flex;justify-content:space-between;"><span style="color:var(--text-secondary);">Subtotal</span><span>${money(subtotal)}</span></div>
      <div style="display:flex;justify-content:space-between;"><span style="color:var(--text-secondary);">Shipping fee</span><span>${money(shippingFee)}</span></div>
      <div style="display:flex;justify-content:space-between;font-weight:800;font-size:16px;margin-top:4px;"><span>Total</span><span>${money(total)}</span></div>
    </div>

    <div style="display:flex;gap:8px;">
      <a href="/api/orders/${o.id}/invoice" target="_blank" rel="noopener noreferrer" class="btn-secondary" style="flex:1;text-align:center;text-decoration:none;">View Invoice</a>
      <a href="/api/orders/${o.id}/invoice.pdf" target="_blank" rel="noopener noreferrer" class="btn-secondary" style="flex:1;text-align:center;text-decoration:none;">Download PDF</a>
    </div>

    <div>
      <label class="form-label" for="order-status-select">Update status</label>
      <select id="order-status-select" class="form-input">
        ${STATUSES.map((s) => `<option value="${s}" ${s === status ? 'selected' : ''}>${statusLabel(s)}</option>`).join('')}
      </select>
      <label class="form-label" for="order-status-note" style="margin-top:10px;">Note (optional)</label>
      <textarea id="order-status-note" class="form-input" rows="2" placeholder="Reason for this status change…"></textarea>
    </div>
  `;

  document.getElementById('order-slideover-footer').innerHTML = `
    <a href="/admin/returns.html?orderId=${o.id}" class="btn-secondary" style="text-decoration:none;text-align:center;">Create Return</a>
    <button type="button" class="btn-secondary" id="order-close-btn">Close</button>
    <button type="button" class="btn-primary" id="order-update-status-btn">Update Status</button>
  `;

  document.getElementById('order-close-btn').addEventListener('click', closeOrderSlideover);
  document.getElementById('order-update-status-btn').addEventListener('click', submitStatusUpdate);
}

async function openOrder(id) {
  try {
    const data = await apiFetch(`/api/admin/orders/${id}`);
    activeOrder = data.order;
    renderOrderDetail();
    openOrderSlideover();
  } catch (err) {
    showError(err.message);
  }
}

function openOrderSlideover() {
  document.getElementById('order-overlay').classList.add('open');
  document.getElementById('order-slideover').classList.add('open');
}

function closeOrderSlideover() {
  document.getElementById('order-overlay').classList.remove('open');
  document.getElementById('order-slideover').classList.remove('open');
}

async function submitStatusUpdate() {
  if (!activeOrder) return;
  const select = document.getElementById('order-status-select');
  const newStatus = select ? select.value : null;
  if (!newStatus) return;

  const noteField = document.getElementById('order-status-note');
  const note = noteField ? noteField.value.trim() : '';
  const payload = { status: newStatus };
  if (note) payload.note = note;

  const btn = document.getElementById('order-update-status-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Updating…';
  }

  try {
    await apiFetch(`/api/admin/orders/${activeOrder.id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });

    activeOrder.status = newStatus;

    const listItem = allOrders.find((o) => String(o.id) === String(activeOrder.id));
    if (listItem) listItem.status = newStatus;

    updateOrderRow({ id: activeOrder.id, status: newStatus });

    // Refetch to get an accurate history list from the server rather than
    // trying to reconstruct the new entry's timestamp on the client.
    await openOrder(activeOrder.id);
  } catch (err) {
    showError(err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Update Status';
    }
  }
}

async function init() {
  admin = await requireAdminAuth();
  if (!admin) return;

  renderShell();
  wireLogout();

  document.getElementById('status-filter').addEventListener('change', (e) => {
    currentFilter = e.target.value;
    renderTable();
  });

  document.getElementById('order-slideover-close').addEventListener('click', closeOrderSlideover);
  document.getElementById('order-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeOrderSlideover();
  });

  await loadOrders();
}

init();
