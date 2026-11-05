import { useState, useEffect } from 'react';
import { OrderContext } from './orderContext';
import { createEmailPayload } from '../utils/emailPayload';
import {
  defaultPricingSettings,
  fetchPricingSettings,
  normalizePricingSettings,
  savePricingSettings,
} from '../utils/appSettings';
import { getDataUrlBytes, optimizeCustomDesignsForSubmission } from '../utils/cropUtils';
import {
  createEmptyCustomerInfo,
  createEmptyDraft,
  draftToDesign,
  getDesignsTotalQuantity,
  getReviewDesigns,
  isDraftComplete,
} from '../utils/customDesigns';

const emptyOrder = {
  ...createEmptyDraft(),
  customerInfo: createEmptyCustomerInfo(),
  designs: [],
};

function parseStoredValue(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch (error) {
    console.warn(`Unable to load ${key} from localStorage:`, error);
    return fallback;
  }
}

function getImageMetadata(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') {
    return null;
  }

  const match = dataUrl.match(/^data:([^;]+);base64,/);

  return {
    mimeType: match?.[1] || 'unknown',
  };
}

function getStringBytes(value) {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).length;
  }

  return new Blob([value]).size;
}

function logImageSubmissionDiagnostic(message, details) {
  console.info(`[image-submission] ${message}`, details);
}

function sanitizeEmailPayload(emailPayload) {
  if (!emailPayload) {
    return null;
  }

  return {
    to: emailPayload.to,
    subject: emailPayload.subject,
    orderId: emailPayload.orderId,
    orderDate: emailPayload.orderDate,
    customer: emailPayload.customer,
    product: emailPayload.product,
    designs: emailPayload.designs,
    cropDetails: emailPayload.cropDetails,
  };
}

function sanitizeDesignForStorage(design) {
  if (!design) {
    return null;
  }

  return {
    ...design,
    photo: null,
    croppedImage: null,
    originalImage: getImageMetadata(design.photo),
    finalImage: getImageMetadata(design.croppedImage),
  };
}

function sanitizeOrderForStorage(orderToStore) {
  if (!orderToStore) {
    return null;
  }

  const designs = Array.isArray(orderToStore.customDesigns)
    ? orderToStore.customDesigns.map(sanitizeDesignForStorage)
    : Array.isArray(orderToStore.designs)
      ? orderToStore.designs.map(sanitizeDesignForStorage)
      : [];

  return {
    ...orderToStore,
    photo: null,
    croppedImage: null,
    designs,
    customDesigns: designs,
    originalImage: getImageMetadata(orderToStore.photo),
    finalImage: getImageMetadata(orderToStore.croppedImage),
    emailPayload: sanitizeEmailPayload(orderToStore.emailPayload),
  };
}

function saveStoredValue(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Unable to save ${key} to localStorage:`, error);
  }
}

function getDesignsPayloadBytes(designs) {
  return (designs || []).reduce((total, design) => {
    return total + getDataUrlBytes(design.photo) + getDataUrlBytes(design.croppedImage);
  }, 0);
}

function validateSubmissionPayloadSize(designs, actualJsonPayloadBytes) {
  const imageBytes = getDesignsPayloadBytes(designs);
  const estimatedJsonBytes = Math.ceil(imageBytes * 1.4);
  const maxActualJsonPayloadBytes = 4 * 1024 * 1024;

  logImageSubmissionDiagnostic('client payload validation', {
    stage: 'client payload validation',
    designCount: designs.length,
    originalImageBytes: imageBytes,
    estimatedPayloadBytes: estimatedJsonBytes,
    actualJsonPayloadBytes,
    maxActualJsonPayloadBytes,
  });

  if (actualJsonPayloadBytes > maxActualJsonPayloadBytes) {
    logImageSubmissionDiagnostic('rejected during client payload validation', {
      stage: 'client payload validation',
      designCount: designs.length,
      estimatedPayloadBytes: estimatedJsonBytes,
      actualJsonPayloadBytes,
      maxActualJsonPayloadBytes,
    });
    throw new Error('Your photos are too large to submit from this device. Please remove a magnet or choose smaller photos.');
  }
}

async function sendOrderEmail(order, turnstileToken) {
  const requestBody = JSON.stringify({ order, turnstileToken });
  const actualJsonPayloadBytes = getStringBytes(requestBody);

  logImageSubmissionDiagnostic('api request payload', {
    stage: 'api request',
    designCount: order.customDesigns?.length || 0,
    estimatedPayloadBytes: Math.ceil(getDesignsPayloadBytes(order.customDesigns) * 1.4),
    actualJsonPayloadBytes,
  });

  const response = await fetch('/api/send-order-email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: requestBody,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    logImageSubmissionDiagnostic('rejected by api request', {
      stage: 'api request',
      status: response.status,
      error: data.error || 'Unable to send order email. Please try again.',
      actualJsonPayloadBytes,
    });
    throw new Error(data.error || 'Unable to send order email. Please try again.');
  }

  return data;
}

function clearWorkflowStorage() {
  try {
    localStorage.removeItem('currentOrder');
    localStorage.removeItem('currentPage');
    localStorage.removeItem('lastSubmittedOrder');
    sessionStorage.removeItem('currentPage');
    sessionStorage.removeItem('lastSubmittedOrder');
  } catch (error) {
    console.warn('Unable to clear workflow storage:', error);
  }
}

export function OrderProvider({ children }) {
  const [order, setOrder] = useState(() => {
    try {
      localStorage.removeItem('currentOrder');
      localStorage.removeItem('currentPage');
      localStorage.removeItem('lastSubmittedOrder');
      sessionStorage.removeItem('currentPage');
      sessionStorage.removeItem('lastSubmittedOrder');
    } catch (error) {
      console.warn('Unable to clear legacy workflow storage:', error);
    }

    return emptyOrder;
  });

  const [orders, setOrders] = useState(() => {
    return parseStoredValue('orders', []);
  });

  const [lastSubmittedOrder, setLastSubmittedOrder] = useState(() => {
    return null;
  });

  const [pricingSettings, setPricingSettings] = useState(() => {
    return defaultPricingSettings;
  });
  const [pricingSettingsStatus, setPricingSettingsStatus] = useState('loading');

  useEffect(() => {
    saveStoredValue('orders', orders.map(sanitizeOrderForStorage));
  }, [orders]);

  useEffect(() => {
    let isCurrent = true;

    async function loadPricingSettings() {
      try {
        const remoteSettings = await fetchPricingSettings();
        if (isCurrent) {
          setPricingSettings(remoteSettings);
          setPricingSettingsStatus('ready');
        }
      } catch (error) {
        console.warn('Unable to load Supabase pricing settings; using defaults:', error);
        if (isCurrent) {
          setPricingSettings(defaultPricingSettings);
          setPricingSettingsStatus('fallback');
        }
      }
    }

    loadPricingSettings();

    return () => {
      isCurrent = false;
    };
  }, []);

  const updatePricingSettings = async (nextSettings, pin) => {
    const savedSettings = await savePricingSettings(
      normalizePricingSettings({
        ...pricingSettings,
        ...nextSettings,
      }),
      pin
    );
    setPricingSettings(savedSettings);
    setPricingSettingsStatus('ready');
    return savedSettings;
  };

  const setMagnetType = (type) => {
    setOrder(prev => ({
      ...prev,
      magnetType: type,
      crop: { x: 0, y: 0 },
      croppedAreaPixels: null,
      zoom: 1,
      croppedImage: null,
      cropVerification: null,
    }));
  };

  const setPhoto = (photoData) => {
    setOrder(prev => ({
      ...prev,
      photo: photoData,
      crop: { x: 0, y: 0 },
      croppedAreaPixels: null,
      zoom: 1,
      croppedImage: null,
      cropVerification: null,
    }));
  };

  const setCrop = (crop) => {
    setOrder(prev => ({ ...prev, crop }));
  };

  const setCroppedAreaPixels = (croppedAreaPixels) => {
    setOrder(prev => ({ ...prev, croppedAreaPixels }));
  };

  const setZoom = (zoom) => {
    setOrder(prev => ({ ...prev, zoom }));
  };

  const setCroppedImage = (croppedImage) => {
    setOrder(prev => ({ ...prev, croppedImage }));
  };

  const setCropVerification = (cropVerification) => {
    setOrder(prev => ({ ...prev, cropVerification }));
  };

  const setQuantity = (quantity) => {
    setOrder(prev => ({
      ...prev,
      quantity: Math.max(1, Math.min(100, Number(quantity) || 1)),
    }));
  };

  const setCustomerInfo = (info) => {
    const { quantity, ...customerFields } = info || {};
    setOrder(prev => ({
      ...prev,
      customerInfo: { ...prev.customerInfo, ...customerFields },
      ...(quantity !== undefined
        ? { quantity: Math.max(1, Math.min(100, Number(quantity) || 1)) }
        : {}),
    }));
  };

  const commitCurrentDesign = () => {
    // Decide success from current state. Do not set a flag inside the setState
    // updater — React 19 may skip eager updater execution when the provider
    // fiber already has pending lanes (e.g. pricing settings load), which made
    // "Add Another Magnet Design" return false and show a false error.
    if (!isDraftComplete(order)) {
      return false;
    }

    setOrder(prev => {
      if (!isDraftComplete(prev)) {
        return prev;
      }

      return {
        ...prev,
        ...createEmptyDraft(),
        customerInfo: prev.customerInfo,
        designs: [...(prev.designs || []), draftToDesign(prev)],
      };
    });

    return true;
  };

  const startAnotherDesign = () => {
    const hasSavedDesigns = (order.designs || []).length > 0;
    const draftComplete = isDraftComplete(order);
    const draftStarted = Boolean(order.photo || order.magnetType || order.croppedImage);

    if (!draftComplete && !hasSavedDesigns) {
      return false;
    }

    // An unfinished draft must be finished or cleared before starting another.
    if (!draftComplete && draftStarted) {
      return false;
    }

    const designCount = draftComplete
      ? (order.designs || []).length + 1
      : (order.designs || []).length;

    if (designCount === 0) {
      return false;
    }

    setOrder(prev => {
      const prevHasSavedDesigns = (prev.designs || []).length > 0;
      const prevDraftComplete = isDraftComplete(prev);
      const prevDraftStarted = Boolean(prev.photo || prev.magnetType || prev.croppedImage);

      if (!prevDraftComplete && !prevHasSavedDesigns) {
        return prev;
      }

      if (!prevDraftComplete && prevDraftStarted) {
        return prev;
      }

      const nextDesigns = prevDraftComplete
        ? [...(prev.designs || []), draftToDesign(prev)]
        : [...(prev.designs || [])];

      if (nextDesigns.length === 0) {
        return prev;
      }

      return {
        ...prev,
        ...createEmptyDraft(),
        customerInfo: prev.customerInfo,
        designs: nextDesigns,
      };
    });

    return true;
  };

  const removeDesign = (designId) => {
    setOrder(prev => ({
      ...prev,
      designs: (prev.designs || []).filter(design => design.id !== designId),
    }));
  };

  const updateSavedDesignQuantity = (designId, quantity) => {
    const nextQuantity = Math.max(1, Math.min(100, Number(quantity) || 1));
    setOrder(prev => ({
      ...prev,
      designs: (prev.designs || []).map(design => (
        design.id === designId
          ? { ...design, quantity: nextQuantity }
          : design
      )),
    }));
  };

  const clearDraft = () => {
    setOrder(prev => ({
      ...prev,
      ...createEmptyDraft(),
      customerInfo: prev.customerInfo,
      designs: prev.designs || [],
    }));
  };

  const submitOrder = async (turnstileToken) => {
    const reviewDesigns = getReviewDesigns(order);

    if (reviewDesigns.length === 0) {
      throw new Error('Add at least one custom magnet design before submitting.');
    }

    const totalQuantity = getDesignsTotalQuantity(reviewDesigns);
    if (totalQuantity < 1 || totalQuantity > 100) {
      throw new Error('Total magnet quantity across all designs must be between 1 and 100.');
    }

    logImageSubmissionDiagnostic('submission started', {
      stage: 'submission start',
      designCount: reviewDesigns.length,
      totalQuantity,
      estimatedPayloadBytes: Math.ceil(getDesignsPayloadBytes(reviewDesigns) * 1.4),
    });

    const optimizedDesigns = await optimizeCustomDesignsForSubmission(reviewDesigns);
    const primaryDesign = optimizedDesigns[0];

    const newOrder = {
      id: Date.now(),
      submittedAt: new Date().toISOString(),
      orderType: 'custom-photo',
      customerInfo: {
        ...order.customerInfo,
        quantity: totalQuantity,
      },
      customDesigns: optimizedDesigns,
      designs: optimizedDesigns,
      totalQuantity,
      // Legacy single-design fields kept for older email helpers / confirmation UI.
      magnetType: primaryDesign.magnetType,
      photo: primaryDesign.photo,
      crop: primaryDesign.crop,
      croppedAreaPixels: primaryDesign.croppedAreaPixels,
      zoom: primaryDesign.zoom,
      croppedImage: primaryDesign.croppedImage,
      cropVerification: primaryDesign.cropVerification,
      quantity: primaryDesign.quantity,
    };

    const pendingRequestBody = JSON.stringify({ order: newOrder, turnstileToken });
    logImageSubmissionDiagnostic('actual payload before client validation', {
      stage: 'pre-client payload validation',
      designCount: optimizedDesigns.length,
      estimatedPayloadBytes: Math.ceil(getDesignsPayloadBytes(optimizedDesigns) * 1.4),
      actualJsonPayloadBytes: getStringBytes(pendingRequestBody),
    });

    validateSubmissionPayloadSize(optimizedDesigns, getStringBytes(pendingRequestBody));

    const emailDelivery = await sendOrderEmail(newOrder, turnstileToken);

    const emailPayload = sanitizeEmailPayload(createEmailPayload(newOrder));

    const storedOrder = {
      ...newOrder,
      clientOrderId: newOrder.id,
      id: emailDelivery.publicOrderNumber || newOrder.id,
      durableOrderId: emailDelivery.orderId || null,
      emailPayload,
      emailDelivery,
    };

    setOrders(prev => [...prev, sanitizeOrderForStorage(storedOrder)]);
    setLastSubmittedOrder(storedOrder);
    setOrder(emptyOrder);
    clearWorkflowStorage();

    return storedOrder;
  };

  const resetOrder = () => {
    setOrder(emptyOrder);
    clearWorkflowStorage();
  };

  return (
    <OrderContext.Provider
      value={{
        order,
        orders,
        lastSubmittedOrder,
        pricingSettings,
        pricingSettingsStatus,
        updatePricingSettings,
        setMagnetType,
        setPhoto,
        setCrop,
        setCroppedAreaPixels,
        setZoom,
        setCroppedImage,
        setCropVerification,
        setQuantity,
        setCustomerInfo,
        commitCurrentDesign,
        startAnotherDesign,
        removeDesign,
        updateSavedDesignQuantity,
        clearDraft,
        submitOrder,
        resetOrder,
      }}
    >
      {children}
    </OrderContext.Provider>
  );
}
