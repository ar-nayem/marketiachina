function resolveOrderOnlyPayment() {
  return {
    paymentMethod: 'order_only',
    paymentStatus: 'not_required',
    paymentExpiresAt: null,
  };
}

module.exports = { resolveOrderOnlyPayment };
