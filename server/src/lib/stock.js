// Pure helper: derives the display-only stock status from a products row.
// Never stored - always recomputed on read from
// bd_stock/cn_stock/low_stock_threshold/inventory_status. Shared by the
// admin inventory page, the public product API, and order creation so all
// three agree on exactly the same definition of "out of stock".
function computeStockStatus(row) {
  if (row.inventory_status === 'pre_order' || row.inventory_status === 'discontinued') {
    return row.inventory_status;
  }
  const total = (row.bd_stock || 0) + (row.cn_stock || 0);
  if (total <= 0) return 'out_of_stock';
  if (total <= row.low_stock_threshold) return 'low_stock';
  return 'in_stock';
}

module.exports = { computeStockStatus };
