import { useEffect, useMemo, useRef, useState } from 'react';
import { useOrder } from '../context/useOrder';
import { getPreviewDimensions } from '../utils/cropUtils';
import { getDesignsTotalQuantity, getMagnetTypeLabel, isDraftComplete } from '../utils/customDesigns';
import { formatCurrency, getCustomDesignsTotal, getMagnetPrice } from '../utils/pricing';
import '../styles/ReviewOrder.css';

const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

function DesignCard({
  title,
  design,
  pricingSettings,
  onRemove,
  onQuantityChange,
  canRemove,
}) {
  const dimensions = getPreviewDimensions(design.magnetType);
  const unitPrice = getMagnetPrice(pricingSettings, design.magnetType);
  const lineTotal = unitPrice * (Number(design.quantity) || 0);

  return (
    <div className="design-card">
      <div className="design-card-header">
        <h3>{title}</h3>
        {canRemove && (
          <button type="button" className="remove-design-button" onClick={onRemove}>
            Remove
          </button>
        )}
      </div>

      <div
        className="order-preview design-card-preview"
        style={{
          '--preview-width': `${Math.min(dimensions.width, 180)}px`,
          '--preview-aspect-ratio': dimensions.aspectRatio,
          borderRadius: dimensions.borderRadius,
        }}
      >
        <img
          src={design.croppedImage}
          alt={`${title} preview`}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      </div>

      <div className="magnet-info">
        <p className="magnet-type">
          <strong>Type:</strong> {getMagnetTypeLabel(design.magnetType)}
        </p>
        <p className="magnet-type">
          <strong>Price:</strong> {formatCurrency(unitPrice)} each
        </p>
        <div className="design-quantity-row">
          <span className="label">Qty:</span>
          <div className="quantity-selector compact">
            <button
              type="button"
              className="qty-btn"
              onClick={() => onQuantityChange((Number(design.quantity) || 1) - 1)}
            >
              −
            </button>
            <input
              type="number"
              min="1"
              max="100"
              value={design.quantity}
              onChange={(event) => onQuantityChange(event.target.value)}
            />
            <button
              type="button"
              className="qty-btn"
              onClick={() => onQuantityChange((Number(design.quantity) || 1) + 1)}
            >
              +
            </button>
          </div>
          <span className="design-line-total">{formatCurrency(lineTotal)}</span>
        </div>
      </div>
    </div>
  );
}

export default function ReviewOrder({ onNext, onBack, onAddAnother }) {
  const {
    order,
    pricingSettings,
    submitOrder,
    startAnotherDesign,
    removeDesign,
    updateSavedDesignQuantity,
    setQuantity,
    clearDraft,
    resetOrder,
  } = useOrder();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [errorIsFromSubmit, setErrorIsFromSubmit] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaReady, setCaptchaReady] = useState(!turnstileSiteKey);
  const captchaRef = useRef(null);
  const widgetIdRef = useRef(null);

  const savedDesigns = useMemo(() => order.designs || [], [order.designs]);
  const draftReady = isDraftComplete(order);
  const draftDesign = useMemo(() => (
    draftReady
      ? {
          id: 'current-draft',
          magnetType: order.magnetType,
          croppedImage: order.croppedImage,
          quantity: order.quantity || 1,
        }
      : null
  ), [draftReady, order.magnetType, order.croppedImage, order.quantity]);

  const allDesignsForTotals = useMemo(() => {
    const designs = [...savedDesigns];
    if (draftDesign) {
      designs.push(draftDesign);
    }
    return designs;
  }, [savedDesigns, draftDesign]);

  const estimatedTotal = getCustomDesignsTotal(pricingSettings, allDesignsForTotals);
  const totalQuantity = getDesignsTotalQuantity(allDesignsForTotals);
  const canSubmit = allDesignsForTotals.length > 0;

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
      setErrorIsFromSubmit(true);
      setSubmitError('Please complete the order verification before submitting.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');
    setErrorIsFromSubmit(false);

    try {
      const submittedOrder = await submitOrder(captchaToken || null);
      console.log('Order submitted:', submittedOrder);
      onNext();
    } catch (error) {
      setErrorIsFromSubmit(true);
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

  const handleAddAnother = () => {
    if (!draftReady && savedDesigns.length === 0) {
      setErrorIsFromSubmit(false);
      setSubmitError('Finish this magnet design before adding another.');
      return;
    }

    if (!draftReady && (order.photo || order.magnetType)) {
      setErrorIsFromSubmit(false);
      setSubmitError('Finish or remove the current magnet design before adding another.');
      return;
    }

    const started = startAnotherDesign();
    if (!started) {
      setErrorIsFromSubmit(false);
      setSubmitError('Unable to start another magnet design. Please try again.');
      return;
    }

    setSubmitError('');
    setErrorIsFromSubmit(false);
    onAddAnother?.();
  };

  const handleClearDraft = () => {
    if (savedDesigns.length === 0) {
      resetOrder();
      onBack();
      return;
    }

    clearDraft();
  };

  if (!canSubmit) {
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
        <p className="subtitle">
          Review each magnet design, then submit one order for Jennifer.
        </p>

        <div className="preview-section designs-section">
          <h2>Your Magnets ({allDesignsForTotals.length})</h2>

          {savedDesigns.map((design, index) => (
            <DesignCard
              key={design.id}
              title={`Magnet ${index + 1}`}
              design={design}
              pricingSettings={pricingSettings}
              canRemove={allDesignsForTotals.length > 1}
              onRemove={() => removeDesign(design.id)}
              onQuantityChange={(value) => updateSavedDesignQuantity(design.id, value)}
            />
          ))}

          {draftDesign && (
            <DesignCard
              title={`Magnet ${savedDesigns.length + 1}`}
              design={draftDesign}
              pricingSettings={pricingSettings}
              canRemove={allDesignsForTotals.length > 1}
              onRemove={handleClearDraft}
              onQuantityChange={(value) => setQuantity(value)}
            />
          )}

          <button
            type="button"
            className="add-another-button"
            onClick={handleAddAnother}
            disabled={isSubmitting || (!draftReady && Boolean(order.photo || order.magnetType))}
          >
            Add Another Magnet Design
          </button>
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
            <span className="label">Designs:</span>
            <span className="value">{allDesignsForTotals.length}</span>
          </div>

          <div className="summary-item">
            <span className="label">Total Magnets:</span>
            <span className="value">{totalQuantity}</span>
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
            disabled={isSubmitting || !captchaReady || !canSubmit}
          >
            {isSubmitting
              ? 'Sending Order...'
              : submitError && errorIsFromSubmit
                ? 'Retry Sending Order'
                : 'Submit Order'}
          </button>
        </div>
      </div>
    </div>
  );
}
