const test = require('node:test');
const assert = require('node:assert/strict');

const { buildInvoiceAttachments } = require('../src/lib/invoice-attachments');

test('builds both PDF and editable Excel attachments for the customer order email', async () => {
  const order = {
    order_number: 'MC-BD-2026-12345', customer_name: 'Rahim Trading', customer_email: 'rahim@example.com',
    customer_phone: '+8801700000000', shipping_address: 'Dhaka, Bangladesh', payment_method: 'cod',
    shipping_method: 'air', subtotal_bdt: 54500, discount_bdt: 0, shipping_fee_bdt: 1200,
    total_bdt: 55700, payment_status: 'pending_payment', status: 'pending', created_at: '2026-11-02 10:30:00',
  };
  const items = [{ product_name_snapshot: 'Headphones', quantity: 10, unit_price_bdt: 5450, line_total_bdt: 54500 }];

  const attachments = await buildInvoiceAttachments(order, items, { businessName: 'Marketia China' });

  assert.equal(attachments.length, 2);
  assert.deepEqual(attachments.map((item) => item.filename), [
    'Invoice-MC-BD-2026-12345.pdf',
    'Invoice-MC-BD-2026-12345.xlsx',
  ]);
  assert.equal(attachments[0].contentType, 'application/pdf');
  assert.equal(attachments[1].contentType, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.equal(attachments[0].content.subarray(0, 4).toString(), '%PDF');
  assert.equal(attachments[1].content.subarray(0, 2).toString(), 'PK');
});
