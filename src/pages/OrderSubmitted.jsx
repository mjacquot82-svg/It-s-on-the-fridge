import { useOrder } from '../context/useOrder';
import { getPreviewDimensions } from '../utils/cropUtils';
import '../styles/OrderSubmitted.css';

export default function OrderSubmitted({ onRestart }) {
  const { lastSubmittedOrder } = useOrder();
  const order = lastSubmittedOrder;
  const dimensions = getPreviewDimensions(order?.magnetType);

  if (!order) {
    return (
      <div className="order-submitted-screen">
        <div className="submitted-content">
          <h1>Order Not Found</h1>
          <p className="confirmation-message">
            We could not find a submitted order on this device.
          </p>
          <button className="restart-button" onClick={onRestart}>
            Design Another Magnet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="order-submitted-screen">
      <div className="submitted-content">
        <div className="success-icon">✓</div>
        
        <h1>Thank You for Your Order!</h1>
        <p className="confirmation-message">
          Jennifer will contact you to confirm pickup and payment.
        </p>
        {order.emailDelivery?.emailStatus === 'email_failed' && (
          <p className="stored-image-note">
            Your order was received, but the email notification may need manual follow-up.
          </p>
        )}

        <div className="order-summary">
          <h2>Order Summary</h2>

          {order.croppedImage && (
            <div className="submitted-preview-wrap">
              <div
                className="submitted-preview"
                style={{
                  '--preview-width': `${Math.min(dimensions.width, 220)}px`,
                  '--preview-aspect-ratio': dimensions.aspectRatio,
                  borderRadius: dimensions.borderRadius,
                }}
              >
                <img src={order.croppedImage} alt="Final magnet preview" />
              </div>
            </div>
          )}

          {!order.croppedImage && order.finalImage && (
            <p className="stored-image-note">
              Final preview image was sent with the order and is not stored on this device.
            </p>
          )}
          
          <div className="summary-item">
            <span className="label">Order ID:</span>
            <span className="value order-id">{order.id}</span>
          </div>

          <div className="summary-item">
            <span className="label">Submitted:</span>
            <span className="value">{new Date(order.submittedAt).toLocaleString()}</span>
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
            <li>You'll receive a call, text, or email to confirm details</li>
            <li>No online payment is required</li>
            <li>Your magnet will be printed after confirmation</li>
          </ul>
        </div>

        <button className="restart-button" onClick={onRestart}>
          Design Another Magnet
        </button>
      </div>
    </div>
  );
}
