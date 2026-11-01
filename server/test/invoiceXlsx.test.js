const test = require('node:test');
const assert = require('node:assert/strict');

const { renderInvoiceXlsxBuffer } = require('../src/lib/invoice-xlsx');
const ExcelJS = require('exceljs');

const order = {
  order_number: 'MC-BD-2026-12345',
  customer_name: 'Rahim Trading',
  customer_email: 'rahim@example.com',
  customer_phone: '+8801700000000',
  shipping_address: 'Dhaka, Bangladesh',
  payment_method: 'cod',
  shipping_method: 'air',
  total_weight_kg: 25,
  shipping_rate_bdt_per_kg: 48,
  subtotal_bdt: 123500,
  discount_bdt: 500,
  shipping_fee_bdt: 1200,
  total_bdt: 124200,
  payment_status: 'pending_payment',
  created_at: '2026-11-02 10:30:00',
};

const items = [
  { product_name_snapshot: 'Noise Cancelling Headphones', quantity: 10, unit_weight_kg: 1, line_weight_kg: 10, unit_price_bdt: 5450, line_total_bdt: 54500 },
  { product_name_snapshot: 'Mechanical Keyboard', quantity: 15, unit_weight_kg: 1, line_weight_kg: 15, unit_price_bdt: 4600, line_total_bdt: 69000 },
];

test('creates an editable executive invoice whose totals recalculate from order lines', async () => {
  const buffer = await renderInvoiceXlsxBuffer(order, items, { businessName: 'Marketia China' });
  assert.ok(Buffer.isBuffer(buffer));
  assert.equal(buffer.subarray(0, 2).toString(), 'PK');

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet('Invoice');

  assert.ok(sheet, 'Invoice worksheet must exist');
  assert.equal(sheet.getCell('A1').value, 'MARKETIA CHINA');
  assert.equal(sheet.getCell('F7').value, 'MC-BD-2026-12345');
  assert.equal(sheet.getCell('B13').value, 'Noise Cancelling Headphones');
  assert.equal(sheet.getCell('C13').value, 1);
  assert.equal(sheet.getCell('D13').value, 10);
  assert.equal(sheet.getCell('E13').value, 5450);
  assert.equal(sheet.getCell('G13').value.formula, 'D13*E13*(1-F13)');
  assert.equal(sheet.getCell('H13').value.formula, 'C13*D13');
  assert.equal(sheet.getCell('G20').value.formula, 'SUM(H13:H17)');
  assert.equal(sheet.getCell('G22').value.formula, 'G20*G21');
  assert.equal(sheet.getCell('G27').value.formula, 'G23-G24+G22+G25-G26');
});
