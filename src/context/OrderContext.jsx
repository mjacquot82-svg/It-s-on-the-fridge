import { createContext, useState, useContext, useEffect } from 'react';
import { createEmailPayload } from '../utils/emailPayload';

const OrderContext = createContext();

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

async function sendOrderEmail(order, turnstileToken) {
  const response = await fetch('/api/send-order-email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ order, turnstileToken }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Unable to send order email. Please try again.');
  }

  return data;
}

export function OrderProvider({ children }) {
  const [order, setOrder] = useState(() => {
    const storedOrder = parseStoredValue('currentOrder', emptyOrder);
    return { ...emptyOrder, ...storedOrder, photo: null, croppedImage: null };
  });

  const [orders, setOrders] = useState(() => {
    return parseStoredValue('orders', []);
  });

  const [lastSubmittedOrder, setLastSubmittedOrder] = useState(() => {
    return parseStoredValue('lastSubmittedOrder', null);
  });

  // Persist only lightweight metadata. Image data stays in memory.
  useEffect(() => {
    saveStoredValue('currentOrder', sanitizeOrderForStorage(order));
  }, [order]);

  // Persist only lightweight order history metadata.
  useEffect(() => {
    saveStoredValue('orders', orders.map(sanitizeOrderForStorage));
  }, [orders]);

  // Persist only lightweight submitted-order metadata.
  useEffect(() => {
    if (lastSubmittedOrder) {
      saveStoredValue('lastSubmittedOrder', sanitizeOrderForStorage(lastSubmittedOrder));
    }
  }, [lastSubmittedOrder]);

  const setMagnetType = (type) => {
    setOrder(prev => ({ ...prev, magnetType: type }));
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
    const newOrder = {
      ...order,
      id: Date.now(),
      submittedAt: new Date().toISOString(),
    };

    const emailDelivery = await sendOrderEmail(newOrder, turnstileToken);
    
    // Generate email payload for Jennifer
    const emailPayload = sanitizeEmailPayload(createEmailPayload(newOrder));
    
    // Store both the order and email payload
    const storedOrder = {
      ...newOrder,
      emailPayload,
      emailDelivery,
    };
    
    setOrders(prev => [...prev, sanitizeOrderForStorage(storedOrder)]);
    setLastSubmittedOrder(storedOrder);
    
    // Reset current order
    setOrder(emptyOrder);

    return storedOrder;
  };

  const resetOrder = () => {
    setOrder(emptyOrder);
  };

  return (
    <OrderContext.Provider
      value={{
        order,
        orders,
        lastSubmittedOrder,
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

export function useOrder() {
  const context = useContext(OrderContext);
  if (!context) {
    throw new Error('useOrder must be used within OrderProvider');
  }
  return context;
}
