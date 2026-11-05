/**
 * Helpers for multi-design custom magnet orders.
 */

export function createEmptyDraft() {
  return {
    magnetType: null,
    photo: null,
    crop: { x: 0, y: 0 },
    croppedAreaPixels: null,
    zoom: 1,
    croppedImage: null,
    cropVerification: null,
    quantity: 1,
  };
}

export function createEmptyCustomerInfo() {
  return {
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    notes: '',
  };
}

export function createDesignId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `design-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function isDraftComplete(orderOrDraft) {
  return Boolean(
    orderOrDraft?.magnetType &&
    orderOrDraft?.photo &&
    orderOrDraft?.croppedImage &&
    Number(orderOrDraft?.quantity) >= 1
  );
}

export function draftToDesign(orderOrDraft) {
  return {
    id: createDesignId(),
    magnetType: orderOrDraft.magnetType === 'round' ? 'round' : 'rectangle',
    photo: orderOrDraft.photo,
    crop: orderOrDraft.crop || { x: 0, y: 0 },
    croppedAreaPixels: orderOrDraft.croppedAreaPixels || null,
    zoom: orderOrDraft.zoom || 1,
    croppedImage: orderOrDraft.croppedImage,
    cropVerification: orderOrDraft.cropVerification || null,
    quantity: Math.max(1, Math.min(100, Number(orderOrDraft.quantity) || 1)),
  };
}

export function getReviewDesigns(order) {
  const saved = Array.isArray(order?.designs) ? order.designs : [];
  if (isDraftComplete(order)) {
    return [...saved, draftToDesign(order)];
  }
  return saved;
}

export function getDesignsTotalQuantity(designs) {
  return (designs || []).reduce((total, design) => total + (Number(design.quantity) || 0), 0);
}

export function getMagnetTypeLabel(magnetType) {
  return magnetType === 'round' ? 'Round Magnet' : 'Rectangle Magnet';
}

/**
 * Normalize a submitted custom order into a designs array.
 * Supports legacy single-design payloads and multi-design payloads.
 */
export function normalizeCustomDesigns(order) {
  if (Array.isArray(order?.customDesigns) && order.customDesigns.length > 0) {
    return order.customDesigns.map((design, index) => ({
      id: design.id || `design-${index + 1}`,
      magnetType: design.magnetType === 'round' ? 'round' : 'rectangle',
      photo: design.photo,
      crop: design.crop || null,
      croppedAreaPixels: design.croppedAreaPixels || null,
      zoom: design.zoom || null,
      croppedImage: design.croppedImage,
      cropVerification: design.cropVerification || null,
      quantity: Math.max(1, Math.min(100, Number(design.quantity) || 1)),
    }));
  }

  if (order?.photo && order?.croppedImage) {
    return [{
      id: order.id ? `design-${order.id}` : 'design-1',
      magnetType: order.magnetType === 'round' ? 'round' : 'rectangle',
      photo: order.photo,
      crop: order.crop || null,
      croppedAreaPixels: order.croppedAreaPixels || null,
      zoom: order.zoom || null,
      croppedImage: order.croppedImage,
      cropVerification: order.cropVerification || null,
      quantity: Math.max(1, Math.min(100, Number(order.customerInfo?.quantity) || 1)),
    }];
  }

  return [];
}
