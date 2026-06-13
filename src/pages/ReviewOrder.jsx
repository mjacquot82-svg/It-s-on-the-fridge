import { useEffect, useRef, useState } from 'react';
import { useOrder } from '../context/useOrder';
import { getPreviewDimensions } from '../utils/cropUtils';
import { formatCurrency, getMagnetPrice, getOrderTotal } from '../utils/pricing';
import '../styles/ReviewOrder.css';

const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

export default function ReviewOrder({ onNext, onBack }) {
  const { order, pricingSettings, submitOrder } = useOrder();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaReady, setCaptchaReady] = useState(!turnstileSiteKey);
  const captchaRef = useRef(null);
  const widgetIdRef = useRef(null);

  const dimensions = getPreviewDimensions(order.magnetType);
  const unitPrice = getMagnetPrice(pricingSettings, order.magnetType);
  const estimatedTotal = getOrderTotal(pricingSettings, order.magnetType, order.customerInfo.quantity);

  useEffect(() => {
    if (!turnstileSiteKey) {
      console.warn('VITE_TURNSTILE_SITE_KEY is not configured; order CAPTCHA is disabled.');
      return undefined;
    }

    let cancelled = false;
    let attempts = 0;

    const renderTurnstile = () => {
      if (cancelled || widgetIdRef.current || !captchaRef.current) {
        return;
      }

      if (!window.turnstile) {
        attempts += 1;
        if (attempts <= 50) {
          window.setTimeout(renderTurnstile, 100);
        }
        return;
      }

      widgetIdRef.current = window.turnstile.render(captchaRef.current, {
        sitekey: turnstileSiteKey,
        callback: (token) => {
          setCaptchaToken(token);
          setCaptchaReady(true);
        },
        'expired-callback': () => {
          setCaptchaToken('');
          setCaptchaReady(false);
        },
        'error-callback': () => {
          setCaptchaToken('');
          setCaptchaReady(false);
          setSubmitError('We could not verify this order. Please refresh and try again.');
        },
      });
    };

    renderTurnstile();

    return () => {
      cancelled = true;
      if (window.turnstile && widgetIdRef.current) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, []);

  const handleSubmit = async () => {
    if (turnstileSiteKey && !captchaToken) {
      setSubmitError('Please complete the order verification before submitting.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const submittedOrder = await submitOrder(captchaToken || null);
      console.log('Order submitted:', submittedOrder);
      onNext();
    } catch (error) {
      setSubmitError(error.message || 'Unable to send your order. Please try again.');
      if (window.turnstile && widgetIdRef.current) {
        window.turnstile.reset(widgetIdRef.current);
        setCaptchaToken('');
        setCaptchaReady(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!order.croppedImage) {
    return (
      <div className="review-order-screen">
        <div className="review-content">
          <h1>Preview Needed</h1>
          <p className="subtitle">
            Please go back and adjust your photo again before submitting your order.
          </p>
          <div className="action-buttons">
            <button className="back-button" onClick={onBack}>
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="review-order-screen">
      <div className="review-content">
        <h1>Review Your Order</h1>
        <p className="subtitle">Please review your magnet preview and contact information.</p>

        <div className="preview-section">
          <h2>Your Magnet</h2>
          <div
            className="order-preview"
            style={{
              '--preview-width': `${dimensions.width}px`,
              '--preview-aspect-ratio': dimensions.aspectRatio,
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
            <p className="magnet-type">
              <strong>Price:</strong> {formatCurrency(unitPrice)} each
            </p>
            <p className="preview-note">
              This preview represents what Jennifer will use for printing.
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

          <div className="summary-item">
            <span className="label">Unit Price:</span>
            <span className="value">{formatCurrency(unitPrice)}</span>
          </div>

          <div className="summary-item total-item">
            <span className="label">Estimated Total:</span>
            <span className="value">{formatCurrency(estimatedTotal)}</span>
          </div>

          {order.customerInfo.notes && (
            <div className="summary-item">
              <span className="label">Notes:</span>
              <span className="value">{order.customerInfo.notes}</span>
            </div>
          )}
        </div>

        <p className="payment-confirmation-note">
          No online payment is required. Jennifer will contact you after submission to confirm your order, pickup, and payment.
        </p>

        {pricingSettings.promotionEnabled && pricingSettings.promotionText && (
          <p className="review-promotion-note">{pricingSettings.promotionText}</p>
        )}

        {submitError && (
          <div className="submit-error" role="alert">
            {submitError}
          </div>
        )}

        {turnstileSiteKey && (
          <div className="order-verification">
            <div ref={captchaRef} className="turnstile-widget" />
          </div>
        )}

        <div className="action-buttons">
          <button className="back-button" onClick={onBack} disabled={isSubmitting}>
            Back
          </button>
          <button
            className="submit-button"
            onClick={handleSubmit}
            disabled={isSubmitting || !captchaReady}
          >
            {isSubmitting ? 'Sending Order...' : submitError ? 'Retry Sending Order' : 'Submit Order'}
          </button>
        </div>
      </div>
    </div>
  );
}
