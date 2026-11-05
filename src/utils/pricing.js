export function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(value) || 0);
}

export function getMagnetPrice(settings, magnetType) {
  if (magnetType === 'round') {
    return Number(settings.roundMagnetPrice) || 0;
  }

  return Number(settings.rectangleMagnetPrice) || 0;
}

export function getOrderTotal(settings, magnetType, quantity) {
  return getMagnetPrice(settings, magnetType) * (Number(quantity) || 0);
}

export function getCustomDesignsTotal(settings, designs) {
  return (designs || []).reduce((total, design) => {
    return total + getOrderTotal(settings, design.magnetType, design.quantity);
  }, 0);
}
