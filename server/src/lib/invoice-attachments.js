const { renderInvoicePdfBuffer } = require('./invoice-pdf');
const { renderInvoiceXlsxBuffer } = require('./invoice-xlsx');

async function buildInvoiceAttachments(order, items, settings) {
  const [pdfBuffer, xlsxBuffer] = await Promise.all([
    renderInvoicePdfBuffer(order, items, settings),
    renderInvoiceXlsxBuffer(order, items, settings),
  ]);

  return [
    {
      filename: `Invoice-${order.order_number}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf',
    },
    {
      filename: `Invoice-${order.order_number}.xlsx`,
      content: xlsxBuffer,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  ];
}

module.exports = { buildInvoiceAttachments };
