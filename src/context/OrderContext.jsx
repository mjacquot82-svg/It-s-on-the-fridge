import React, { createContext, useState, useContext, useEffect } from 'react';
import { createEmailPayload } from '../utils/emailPayload';

const OrderContext = createContext();

export function OrderProvider({ children }) {
  const [order, setOrder] = useState(() => {
    // Load from localStorage if available
    const saved = localStorage.getItem('currentOrder');
    return saved ? JSON.parse(saved) : {
      magnetType: null, // 'round' or 'rectangle'
      photo: null, // base64 data URL - original uploaded image
      crop: { x: 0, y: 0 },
      zoom: 1,
      croppedImage: null, // Final cropped image
      customerInfo: {
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
        quantity: 1,
        notes: '',
      },
    };
  });

  const [orders, setOrders] = useState(() => {
    const saved = localStorage.getItem('orders');
    return saved ? JSON.parse(saved) : [];
  });

  // Persist order to localStorage
  useEffect(() => {
    localStorage.setItem('currentOrder', JSON.stringify(order));
  }, [order]);

  // Persist orders to localStorage
  useEffect(() => {
    localStorage.setItem('orders', JSON.stringify(orders));
  }, [orders]);

  const setMagnetType = (type) => {
    setOrder(prev => ({ ...prev, magnetType: type }));
  };

  const setPhoto = (photoData) => {
    setOrder(prev => ({ ...prev, photo: photoData, crop: { x: 0, y: 0 }, zoom: 1 }));
  };

  const setCrop = (crop) => {
    setOrder(prev => ({ ...prev, crop }));
  };

  const setZoom = (zoom) => {
    setOrder(prev => ({ ...prev, zoom }));
  };

  const setCroppedImage = (croppedImage) => {
    setOrder(prev => ({ ...prev, croppedImage }));
  };

  const setCustomerInfo = (info) => {
    setOrder(prev => ({
      ...prev,
      customerInfo: { ...prev.customerInfo, ...info },
    }));
  };

  const submitOrder = () => {
    const newOrder = {
      ...order,
      id: Date.now(),
      submittedAt: new Date().toISOString(),
    };
    
    // Generate email payload for Jennifer
    const emailPayload = createEmailPayload(newOrder);
    
    // Store both the order and email payload
    const storedOrder = {
      ...newOrder,
      emailPayload,
    };
    
    setOrders(prev => [...prev, storedOrder]);
    
    // Reset current order
    setOrder({
      magnetType: null,
      photo: null,
      crop: { x: 0, y: 0 },
      zoom: 1,
      croppedImage: null,
      customerInfo: {
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
        quantity: 1,
        notes: '',
      },
    });

    return storedOrder;
  };

  const resetOrder = () => {
    setOrder({
      magnetType: null,
      photo: null,
      crop: { x: 0, y: 0 },
      zoom: 1,
      croppedImage: null,
      customerInfo: {
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
        quantity: 1,
        notes: '',
      },
    });
  };

  return (
    <OrderContext.Provider
      value={{
        order,
        orders,
        setMagnetType,
        setPhoto,
        setCrop,
        setZoom,
        setCroppedImage,
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
