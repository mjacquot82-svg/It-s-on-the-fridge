import { useState, useEffect } from 'react';
import { OrderContext } from './orderContext';
import { createEmailPayload } from '../utils/emailPayload';
import {
  defaultPricingSettings,
  fetchPricingSettings,
  normalizePricingSettings,
  savePricingSettings,
} from '../utils/appSettings';
import { getDataUrlBytes, optimizeOrderImagesForSubmission } from '../utils/cropUtils';

const emptyOrder = {
  magnetType: null,
  photo: null,
  crop: { x: 0, y: 0 },
  croppedAreaPixels: null,
  zoom: 1,
  croppedImage: null,
  cropVerification: null,
  customerInfo: {
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    quantity: 1,
    notes: '',
  },
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
    cropDetails: emailPayload.cropDetails,
  };
}

function sanitizeOrderForStorage(orderToStore) {
  if (!orderToStore) {
    return null;
  }

  return {
    ...orderToStore,
    photo: null,
    croppedImage: null,
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

function validateSubmissionPayloadSize(order, actualJsonPayloadBytes) {
  const originalBytes = getDataUrlBytes(order.photo);
  const croppedBytes = getDataUrlBytes(order.croppedImage);
  const estimatedJsonBytes = Math.ceil((originalBytes + croppedBytes) * 1.4);
  const maxActualJsonPayloadBytes = 4 * 1024 * 1024;

  logImageSubmissionDiagnostic('client payload validation', {
    stage: 'client payload validation',
    originalImageBytes: originalBytes,
    croppedImageBytes: croppedBytes,
    estimatedPayloadBytes: estimatedJsonBytes,
    actualJsonPayloadBytes,
    maxActualJsonPayloadBytes,
  });

  if (actualJsonPayloadBytes > maxActualJsonPayloadBytes) {
    logImageSubmissionDiagnostic('rejected during client payload validation', {
      stage: 'client payload validation',
      originalImageBytes: originalBytes,
      croppedImageBytes: croppedBytes,
      estimatedPayloadBytes: estimatedJsonBytes,
      actualJsonPayloadBytes,
      maxActualJsonPayloadBytes,
    });
    throw new Error('Your photo is too large to submit from this device. Please go back and choose a smaller photo, or take a screenshot of the photo and upload that instead.');
  }
}

async function sendOrderEmail(order, turnstileToken) {
  const requestBody = JSON.stringify({ order, turnstileToken });
  const actualJsonPayloadBytes = getStringBytes(requestBody);

  logImageSubmissionDiagnostic('api request payload', {
    stage: 'api request',
    originalImageBytes: getDataUrlBytes(order.photo),
    croppedImageBytes: getDataUrlBytes(order.croppedImage),
    estimatedPayloadBytes: Math.ceil((getDataUrlBytes(order.photo) + getDataUrlBytes(order.croppedImage)) * 1.4),
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

  // Persist only lightweight order history metadata.
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

  const setCustomerInfo = (info) => {
    setOrder(prev => ({
      ...prev,
      customerInfo: { ...prev.customerInfo, ...info },
    }));
  };

  const submitOrder = async (turnstileToken) => {
    logImageSubmissionDiagnostic('submission started', {
      stage: 'submission start',
      originalImageBytes: getDataUrlBytes(order.photo),
      croppedImageBytes: getDataUrlBytes(order.croppedImage),
      estimatedPayloadBytes: Math.ceil((getDataUrlBytes(order.photo) + getDataUrlBytes(order.croppedImage)) * 1.4),
    });

    const newOrder = await optimizeOrderImagesForSubmission({
      ...order,
      id: Date.now(),
      submittedAt: new Date().toISOString(),
    });

    const pendingRequestBody = JSON.stringify({ order: newOrder, turnstileToken });
    logImageSubmissionDiagnostic('actual payload before client validation', {
      stage: 'pre-client payload validation',
      originalImageBytes: getDataUrlBytes(newOrder.photo),
      croppedImageBytes: getDataUrlBytes(newOrder.croppedImage),
      estimatedPayloadBytes: Math.ceil((getDataUrlBytes(newOrder.photo) + getDataUrlBytes(newOrder.croppedImage)) * 1.4),
      actualJsonPayloadBytes: getStringBytes(pendingRequestBody),
    });

    validateSubmissionPayloadSize(newOrder, getStringBytes(pendingRequestBody));

    const emailDelivery = await sendOrderEmail(newOrder, turnstileToken);
    
    // Generate email payload for Jennifer
    const emailPayload = sanitizeEmailPayload(createEmailPayload(newOrder));
    
    // Store both the order and email payload
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
    
    // Reset current order
    setOrder(emptyOrder);
    try {
      localStorage.removeItem('currentOrder');
      localStorage.removeItem('currentPage');
      sessionStorage.removeItem('currentPage');
      sessionStorage.removeItem('lastSubmittedOrder');
    } catch (error) {
      console.warn('Unable to clear completed workflow storage:', error);
    }

    return storedOrder;
  };

  const resetOrder = () => {
    setOrder(emptyOrder);
    try {
      localStorage.removeItem('currentOrder');
      localStorage.removeItem('currentPage');
      localStorage.removeItem('lastSubmittedOrder');
      sessionStorage.removeItem('currentPage');
      sessionStorage.removeItem('lastSubmittedOrder');
    } catch (error) {
      console.warn('Unable to clear workflow storage:', error);
    }
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
        setCustomerInfo,
        submitOrder,
        resetOrder,
      }}
    >
      {children}
    </OrderContext.Provider>
  );
}
