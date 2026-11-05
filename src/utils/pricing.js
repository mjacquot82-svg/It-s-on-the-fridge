export function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(value) || 0);
}

/** Pack deals + bulk rate shown on Review (matches Jennifer’s promo banner). */
export const defaultQuantityPacks = [
  { quantity: 3, price: 12 },
  { quantity: 5, price: 18 },
  { quantity: 10, price: 35 },
];

export const defaultBulkPricing = {
  minQuantity: 25,
  unitPrice: 3,
};

export function getMagnetPrice(settings, magnetType) {
  if (magnetType === 'round') {
    return Number(settings.roundMagnetPrice) || 0;
  }

  return Number(settings.rectangleMagnetPrice) || 0;
}

/**
 * Lowest total for `quantity` magnets using singles at `unitPrice`,
 * configured pack deals, and the bulk unit rate for large orders.
 */
export function getQuantityDiscountedTotal(settings, quantity, unitPrice) {
  const qty = Math.max(0, Math.floor(Number(quantity) || 0));
  const unit = Number(unitPrice) || 0;
  if (qty === 0) {
    return 0;
  }

  const packs = Array.isArray(settings?.quantityPacks) && settings.quantityPacks.length > 0
    ? settings.quantityPacks
    : defaultQuantityPacks;
  const bulkMin = Number(settings?.bulkMinQuantity ?? defaultBulkPricing.minQuantity);
  const bulkUnit = Number(settings?.bulkUnitPrice ?? defaultBulkPricing.unitPrice);

  if (Number.isFinite(bulkMin) && Number.isFinite(bulkUnit) && qty >= bulkMin) {
    return qty * bulkUnit;
  }

  const roundBase = Number(settings?.roundMagnetPrice) || defaultBulkPricing.unitPrice || 5;
  const packScale = roundBase > 0 ? unit / roundBase : 1;

  const costs = Array(qty + 1).fill(Number.POSITIVE_INFINITY);
  costs[0] = 0;

  for (let n = 1; n <= qty; n += 1) {
    costs[n] = Math.min(costs[n], costs[n - 1] + unit);

    for (const pack of packs) {
      const packQty = Math.floor(Number(pack.quantity) || 0);
      const packPrice = Number(pack.price);
      if (packQty < 1 || !Number.isFinite(packPrice) || packPrice < 0 || n < packQty) {
        continue;
      }
      costs[n] = Math.min(costs[n], costs[n - packQty] + packPrice * packScale);
    }
  }

  return costs[qty];
}

export function getOrderTotal(settings, magnetType, quantity) {
  return getQuantityDiscountedTotal(
    settings,
    quantity,
    getMagnetPrice(settings, magnetType),
  );
}

export function getCustomDesignsTotal(settings, designs) {
  const list = designs || [];
  if (list.length === 0) {
    return 0;
  }

  const totalQuantity = list.reduce((sum, design) => sum + (Number(design.quantity) || 0), 0);
  const undiscounted = list.reduce((sum, design) => {
    return sum + getMagnetPrice(settings, design.magnetType) * (Number(design.quantity) || 0);
  }, 0);

  if (totalQuantity <= 0) {
    return 0;
  }

  const types = new Set(list.map((design) => design.magnetType));
  if (types.size === 1) {
    const onlyType = list[0].magnetType;
    return getQuantityDiscountedTotal(
      settings,
      totalQuantity,
      getMagnetPrice(settings, onlyType),
    );
  }

  // Mixed shapes: apply the same volume savings ratio as if all were the average unit price.
  const averageUnit = undiscounted / totalQuantity;
  const discounted = getQuantityDiscountedTotal(settings, totalQuantity, averageUnit);
  return Math.min(undiscounted, discounted);
}

export function getVolumeSavings(settings, designs) {
  const list = designs || [];
  const undiscounted = list.reduce((sum, design) => {
    return sum + getMagnetPrice(settings, design.magnetType) * (Number(design.quantity) || 0);
  }, 0);
  const discounted = getCustomDesignsTotal(settings, list);
  return Math.max(0, undiscounted - discounted);
}
