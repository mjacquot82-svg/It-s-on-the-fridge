import React from 'react';
import { useOrder } from '../context/OrderContext';
import { getPreviewDimensions } from '../utils/cropUtils';
import '../styles/ReviewOrder.css';

export default function ReviewOrder({ onNext, onBack }) {
  const { order, submitOrder } = useOrder();

  const dimensions = getPreviewDimensions(order.magnetType);

  const handleSubmit = () => {
    const submittedOrder = submitOrder();
    console.log('Order submitted:', submittedOrder);
    onNext();
  };

  return (
    <div className="review-order-screen">
      <div className="review-content">
        <h1>Review Your Order</h1>
        <p className="subtitle">Please review your magnet design and information</p>

        <div className="preview-section">
          <h2>Your Magnet</h2>
          <div 
            className="order-preview" 
            style={{ 
              width: `${dimensions.width}px`,
              height: `${dimensions.height}px`,
              borderRadius: dimensions.borderRadius,
            }}
          >
            <img 
              src={order.croppedImage} 
              alt="Final preview" 
              style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'cover' 
              }}
            />
          </div>
          <div className="magnet-info">
            <p className="magnet-type">
              <strong>Type:</strong> {order.magnetType === 'round' ? 'Round Magnet' : 'Rectangle Magnet'}
            </p>
            <p className="preview-note">
              ℹ️ This preview represents what will be printed.
            </p>
          </div>
        </div>

        <div className="order-summary">
          <h2>Order Details</h2>
          
          <div className="summary-item">
            <span className="label">Name:</span>
            <span className="value">{order.customerInfo.firstName} {order.customerInfo.lastName}</span>
          </div>

          <div className="summary-item">
            <span className="label">Phone:</span>
            <span className="value">{order.customerInfo.phone}</span>
          </div>

          <div className="summary-item">
            <span className="label">Email:</span>
            <span className="value">{order.customerInfo.email}</span>
          </div>

          <div className="summary-item">
            <span className="label">Quantity:</span>
            <span className="value">{order.customerInfo.quantity}</span>
          </div>

          {order.customerInfo.notes && (
            <div className="summary-item">
              <span className="label">Notes:</span>
              <span className="value">{order.customerInfo.notes}</span>
            </div>
          )}
        </div>

        <div className="action-buttons">
          <button className="back-button" onClick={onBack}>
            Back
          </button>
          <button className="submit-button" onClick={handleSubmit}>
            Submit Order
          </button>
        </div>
      </div>
    </div>
  );
}
