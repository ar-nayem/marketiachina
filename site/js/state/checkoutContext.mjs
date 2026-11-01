function cloneItem(item) {
  return { ...item };
}

export function createCartCheckoutContext(cartState) {
  return {
    mode: 'cart',
    items: cartState.items.map(cloneItem),
    shippingMethod: cartState.shippingMethod,
    appliedPromo: cartState.appliedPromo ? { ...cartState.appliedPromo } : null,
    shouldClearCart: true,
  };
}

export function createDirectCheckoutContext({
  productId,
  quantity = 1,
  options = {},
  shippingMethod = 'air',
}) {
  return {
    mode: 'direct',
    items: [{ productId, quantity: Math.max(1, Number(quantity) || 1), ...options }],
    shippingMethod: shippingMethod === 'sea' ? 'sea' : 'air',
    appliedPromo: null,
    shouldClearCart: false,
  };
}

export function calculateCheckoutTotals({
  items,
  products,
  shippingMethod,
  appliedPromo,
  shippingRates,
  currencyCode = 'BDT',
}) {
  let subtotalBDT = 0;
  let totalItems = 0;
  let totalWeightKg = 0;

  for (const item of items) {
    const product = products.find((candidate) => candidate.id === item.productId);
    if (!product) continue;
    let unitPrice = product.priceBDT;
    const tier = product.wholesaleTiers?.find(
      (candidate) => item.quantity >= candidate.min && item.quantity <= candidate.max
    );
    if (tier) unitPrice = tier.priceBDT;
    subtotalBDT += unitPrice * item.quantity;
    totalItems += item.quantity;
    const unitWeightKg = Number(product.packageWeightKg) > 0 ? Number(product.packageWeightKg) : 1;
    totalWeightKg += unitWeightKg * item.quantity;
  }

  const discountAmountBDT = appliedPromo
    ? Math.round(subtotalBDT * (appliedPromo.discountPercent / 100))
    : 0;
  const shippingRate = shippingMethod === 'sea'
    ? shippingRates.seaBdtPerKg
    : shippingRates.airBdtPerKg;
  const shippingFeeBDT = Math.round(totalWeightKg * shippingRate * 100) / 100;
  const finalTotalBDT = Math.max(0, subtotalBDT - discountAmountBDT + shippingFeeBDT);

  let multiplier = 1;
  let symbol = '৳';
  if (currencyCode === 'USD') {
    multiplier = 1 / 122.5;
    symbol = '$';
  } else if (currencyCode === 'CNY') {
    multiplier = 1 / 16.9;
    symbol = '¥';
  }
  const format = (value) => `${symbol}${(value * multiplier).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })}`;

  return {
    totalItems,
    totalWeightKg,
    shippingRateBDTPerKg: shippingRate,
    subtotalBDT,
    subtotalFormatted: format(subtotalBDT),
    discountAmountBDT,
    discountFormatted: format(discountAmountBDT),
    shippingFeeBDT,
    shippingFeeFormatted: format(shippingFeeBDT),
    finalTotalBDT,
    finalTotalFormatted: format(finalTotalBDT),
    shippingMethod,
    appliedPromo,
  };
}
