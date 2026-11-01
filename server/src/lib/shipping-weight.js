const DEFAULT_UNIT_WEIGHT_KG = 1;

function normalizeUnitWeight(value) {
  const weight = Number(value);
  return Number.isFinite(weight) && weight > 0 ? weight : DEFAULT_UNIT_WEIGHT_KG;
}

function calculateWeightBasedShipping({ items, shippingMethod, rates }) {
  const totalWeightKg = (items || []).reduce(
    (sum, item) => sum + Math.max(0, Number(item.quantity) || 0) * normalizeUnitWeight(item.unitWeightKg),
    0
  );
  const shippingRateBDTPerKg = shippingMethod === 'sea'
    ? Number(rates.seaBdtPerKg) || 0
    : Number(rates.airBdtPerKg) || 0;
  const shippingFeeBDT = Math.round(totalWeightKg * shippingRateBDTPerKg * 100) / 100;

  return { totalWeightKg, shippingRateBDTPerKg, shippingFeeBDT };
}

module.exports = { DEFAULT_UNIT_WEIGHT_KG, normalizeUnitWeight, calculateWeightBasedShipping };
