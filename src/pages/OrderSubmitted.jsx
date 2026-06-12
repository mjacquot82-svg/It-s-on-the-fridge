import React from 'react';
import { useOrder } from '../context/OrderContext';
import '../styles/OrderSubmitted.css';

export default function OrderSubmitted({ onRestart }) {
  const { order } = useOrder();

  return (
    <div className="order-submitted-screen">
      <div className="submitted-content">
        <div className="success-icon">✓</div>
        
        <h1>Thank You for Your Order!</h1>
        <p className="confirmation-message">
          We'll contact you soon regarding pickup and payment.
        </p>

        <div className="order-summary">
          <h2>Order Summary</h2>
          
          <div className="summary-item">
            <span className="label">Order ID:</span>
            <span className="value order-id">{order.id}</span>
          </div>

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
            <span className="label">Magnet Type:</span>
            <span className="value">
              {order.magnetType === 'round' ? 'Round Magnet' : 'Rectangle Magnet'}
            </span>
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

        <div className="next-steps">
          <h3>What Happens Next?</h3>
          <ul>
            <li>Jennifer will review your order</li>
            <li>You'll receive a call or text to confirm details</li>
            <li>Discuss payment options and pickup time</li>
            <li>Your beautiful magnet will be printed and ready for you</li>
          </ul>
        </div>

        <button className="restart-button" onClick={onRestart}>
          Design Another Magnet
        </button>
      </div>
    </div>
  );
}
