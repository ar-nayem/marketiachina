const ExcelJS = require('exceljs');

const COLORS = {
  navy: '111827',
  red: 'E11D48',
  white: 'FFFFFF',
  ink: '1F2937',
  muted: '64748B',
  line: 'E2E8F0',
  edit: 'FEF3C7',
  calc: 'EFF6FF',
  cream: 'FFF7ED',
};

const MONEY_FORMAT = '৳#,##0;[Red]-৳#,##0';

function text(value, fallback = '') {
  return value == null ? fallback : String(value);
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value) {
  if (!value) return '';
  const parsed = new Date(String(value).replace(' ', 'T') + (String(value).includes('Z') ? '' : 'Z'));
  return Number.isNaN(parsed.getTime()) ? text(value) : parsed;
}

function setEditable(cell, value) {
  cell.value = value;
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.edit } };
  cell.border = {
    top: { style: 'thin', color: { argb: 'FCD34D' } },
    left: { style: 'thin', color: { argb: 'FCD34D' } },
    bottom: { style: 'thin', color: { argb: 'FCD34D' } },
    right: { style: 'thin', color: { argb: 'FCD34D' } },
  };
}

function columnNumber(letters) {
  return [...letters].reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0);
}

function eachCellInRange(sheet, address, callback) {
  const [from, to] = address.split(':');
  const parse = (cell) => {
    const match = /^([A-Z]+)(\d+)$/.exec(cell);
    return { column: columnNumber(match[1]), row: Number(match[2]) };
  };
  const start = parse(from);
  const end = parse(to || from);
  for (let row = start.row; row <= end.row; row += 1) {
    for (let column = start.column; column <= end.column; column += 1) callback(sheet.getCell(row, column));
  }
}

function setOutline(sheet, address) {
  eachCellInRange(sheet, address, (cell) => {
    cell.border = {
      top: { style: 'thin', color: { argb: COLORS.line } },
      left: { style: 'thin', color: { argb: COLORS.line } },
      bottom: { style: 'thin', color: { argb: COLORS.line } },
      right: { style: 'thin', color: { argb: COLORS.line } },
    };
  });
}

async function renderInvoiceXlsxBuffer(order, items, settings = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = settings.businessName || 'Marketia China';
  workbook.created = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;
  workbook.calcProperties.forceFullCalc = true;
  workbook.calcProperties.calcMode = 'auto';

  const sheet = workbook.addWorksheet('Invoice', {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1, paperSize: 9 },
    headerFooter: { oddFooter: 'Marketia China • Customer editable copy' },
  });

  const widths = [5, 28, 14, 11, 16, 14, 18, 16];
  widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
  sheet.properties.defaultRowHeight = 20;
  sheet.eachRow((row) => { row.font = { name: 'Arial', size: 10, color: { argb: COLORS.ink } }; });

  sheet.mergeCells('A1:H1');
  sheet.getCell('A1').value = text(settings.businessName, 'Marketia China').toUpperCase();
  sheet.getCell('A1').font = { name: 'Arial', size: 22, bold: true, color: { argb: COLORS.white } };
  sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navy } };
  sheet.getCell('A1').alignment = { vertical: 'middle' };
  sheet.getRow(1).height = 38;

  sheet.mergeCells('A2:H2');
  sheet.getCell('A2').value = 'EXECUTIVE INVOICE  •  Yellow cells are editable  •  Totals recalculate automatically';
  sheet.getCell('A2').font = { name: 'Arial', size: 9, color: { argb: COLORS.white } };
  sheet.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.red } };

  sheet.mergeCells('A4:D4');
  sheet.getCell('A4').value = 'INVOICE';
  sheet.getCell('A4').font = { name: 'Arial', size: 20, bold: true, color: { argb: COLORS.red } };

  sheet.getCell('A6').value = 'BILL TO';
  sheet.getCell('E6').value = 'INVOICE DETAILS';
  ['A6', 'E6'].forEach((ref) => { sheet.getCell(ref).font = { name: 'Arial', size: 9, bold: true, color: { argb: COLORS.muted } }; });

  const customerValues = [order.customer_name, order.shipping_address, order.customer_email, order.customer_phone];
  customerValues.forEach((value, index) => {
    const row = 7 + index;
    sheet.mergeCells(`A${row}:C${row}`);
    setEditable(sheet.getCell(`A${row}`), text(value));
  });

  const details = [
    ['Invoice No.', order.order_number, 'Date', formatDate(order.created_at)],
    ['Order No.', order.order_number, 'Shipping', text(order.shipping_method).toUpperCase()],
    ['Payment', order.payment_method === 'order_only' ? 'No verification required' : text(order.payment_method).toUpperCase(), 'Currency', 'BDT'],
    ['Payment Status', text(order.payment_status).replaceAll('_', ' '), 'Status', text(order.status, 'pending').toUpperCase()],
  ];
  details.forEach((values, offset) => {
    const row = 7 + offset;
    sheet.getCell(`E${row}`).value = values[0];
    setEditable(sheet.getCell(`F${row}`), values[1]);
    sheet.getCell(`G${row}`).value = values[2];
    setEditable(sheet.getCell(`H${row}`), values[3]);
  });
  sheet.getCell('H7').numFmt = 'dd-mmm-yyyy';

  const headers = ['#', 'PRODUCT', 'UNIT WT. (KG)', 'QTY', 'UNIT PRICE', 'DISCOUNT', 'LINE TOTAL', 'TOTAL WT. (KG)'];
  headers.forEach((header, index) => {
    const cell = sheet.getCell(12, index + 1);
    cell.value = header;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navy } };
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: COLORS.white } };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
  sheet.getRow(12).height = 28;

  const maxItemRows = Math.max(5, items.length);
  items.slice(0, maxItemRows).forEach((item, index) => {
    const row = 13 + index;
    sheet.getCell(`A${row}`).value = index + 1;
    setEditable(sheet.getCell(`B${row}`), text(item.product_name_snapshot));
    setEditable(sheet.getCell(`C${row}`), number(item.unit_weight_kg) || 1);
    setEditable(sheet.getCell(`D${row}`), number(item.quantity));
    setEditable(sheet.getCell(`E${row}`), number(item.unit_price_bdt));
    setEditable(sheet.getCell(`F${row}`), 0);
    sheet.getCell(`G${row}`).value = { formula: `D${row}*E${row}*(1-F${row})`, result: number(item.line_total_bdt) };
    sheet.getCell(`G${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.calc } };
    sheet.getCell(`G${row}`).font = { bold: true };
    sheet.getCell(`H${row}`).value = { formula: `C${row}*D${row}`, result: number(item.line_weight_kg) };
    sheet.getCell(`H${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.calc } };
  });
  for (let index = items.length; index < maxItemRows; index += 1) {
    const row = 13 + index;
    sheet.getCell(`A${row}`).value = index + 1;
    ['B', 'C', 'D', 'E', 'F'].forEach((col) => setEditable(sheet.getCell(`${col}${row}`), ['C', 'D', 'E', 'F'].includes(col) ? 0 : ''));
    sheet.getCell(`G${row}`).value = { formula: `D${row}*E${row}*(1-F${row})`, result: 0 };
    sheet.getCell(`G${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.calc } };
    sheet.getCell(`H${row}`).value = { formula: `C${row}*D${row}`, result: 0 };
    sheet.getCell(`H${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.calc } };
  }
  setOutline(sheet, `A13:H${12 + maxItemRows}`);
  sheet.getColumn('E').numFmt = MONEY_FORMAT;
  sheet.getColumn('F').numFmt = '0%';
  sheet.getColumn('G').numFmt = MONEY_FORMAT;
  sheet.getColumn('C').numFmt = '0.00';
  sheet.getColumn('H').numFmt = '0.00';

  const summaryStart = Math.max(20, 15 + maxItemRows);
  const summaryRows = [
    ['Total Weight (kg)', { formula: `SUM(H13:H${12 + maxItemRows})`, result: number(order.total_weight_kg) }],
    ['Shipping Rate (BDT/kg)', number(order.shipping_rate_bdt_per_kg)],
    ['Shipping', { formula: `G${summaryStart}*G${summaryStart + 1}`, result: number(order.shipping_fee_bdt) }],
    ['Subtotal', { formula: `SUM(G13:G${12 + maxItemRows})`, result: number(order.subtotal_bdt) }],
    ['Order Discount', number(order.discount_bdt)],
    ['Tax / Fees', 0],
    ['Paid', 0],
    ['BALANCE', { formula: `G${summaryStart + 3}-G${summaryStart + 4}+G${summaryStart + 2}+G${summaryStart + 5}-G${summaryStart + 6}`, result: number(order.total_bdt) }],
  ];
  summaryRows.forEach(([label, value], index) => {
    const row = summaryStart + index;
    sheet.getCell(`E${row}`).value = label;
    sheet.getCell(`G${row}`).value = value;
  });
  [summaryStart + 1, summaryStart + 4, summaryStart + 5, summaryStart + 6].forEach((row) => setEditable(sheet.getCell(`G${row}`), sheet.getCell(`G${row}`).value));
  setOutline(sheet, `E${summaryStart}:G${summaryStart + 7}`);
  eachCellInRange(sheet, `G${summaryStart + 1}:G${summaryStart + 7}`, (cell) => { cell.numFmt = MONEY_FORMAT; });
  sheet.getCell(`G${summaryStart}`).numFmt = '0.00';
  eachCellInRange(sheet, `E${summaryStart + 7}:G${summaryStart + 7}`, (cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.red } };
    cell.font = { name: 'Arial', size: 12, bold: true, color: { argb: COLORS.white } };
  });

  sheet.mergeCells(`A${summaryStart}:C${summaryStart + 3}`);
  sheet.getCell(`A${summaryStart}`).value = 'THANK YOU\nThis workbook is editable. Update yellow cells; totals recalculate automatically.\nGenerated from your Marketia China order.';
  sheet.getCell(`A${summaryStart}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.cream } };
  sheet.getCell(`A${summaryStart}`).alignment = { wrapText: true, vertical: 'middle' };
  sheet.getCell(`A${summaryStart}`).font = { name: 'Arial', size: 10, italic: true, color: { argb: COLORS.ink } };

  sheet.pageSetup.printArea = `A1:H${summaryStart + 7}`;
  sheet.autoFilter = { from: 'A12', to: `H${12 + maxItemRows}` };
  sheet.views = [{ state: 'frozen', ySplit: 12, showGridLines: false }];

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

module.exports = { renderInvoiceXlsxBuffer };
