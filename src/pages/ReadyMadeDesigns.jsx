import { useEffect, useMemo, useRef, useState } from 'react';
import MagnetPreview from '../components/MagnetPreview';
import {
  emptyCustomerTemplateLibrary,
  fetchCustomerTemplateLibrary,
} from '../utils/templates';
import '../styles/ReadyMadeDesigns.css';

const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

const emptyCustomerInfo = {
  name: '',
  phone: '',
  email: '',
};

function getTotalQuantity(cartItems) {
  return cartItems.reduce((total, item) => total + item.quantity, 0);
}

function createReadyMadeOrder(cartItems, customerInfo) {
  return {
    id: Date.now(),
    orderType: 'ready-made',
    submittedAt: new Date().toISOString(),
    customerInfo,
    readyMadeItems: cartItems.map(item => ({
      templateNumber: item.templateNumber,
      title: item.title,
      quantity: item.quantity,
    })),
    totalQuantity: getTotalQuantity(cartItems),
  };
}

function getTemplateShape(template) {
  return template.shape === 'round' ? 'round' : 'rectangle';
}

async function submitReadyMadeOrder(order, turnstileToken) {
  const response = await fetch('/api/send-order-email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ order, turnstileToken }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Unable to send your order. Please try again.');
  }

  return data;
}

export default function ReadyMadeDesigns({ onBack }) {
  const [templateLibrary, setTemplateLibrary] = useState(emptyCustomerTemplateLibrary);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [cartItems, setCartItems] = useState([]);
  const [viewMode, setViewMode] = useState('browse');
  const [customerInfo, setCustomerInfo] = useState(emptyCustomerInfo);
  const [customerErrors, setCustomerErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submittedOrder, setSubmittedOrder] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaReady, setCaptchaReady] = useState(!turnstileSiteKey);
  const captchaRef = useRef(null);
  const widgetIdRef = useRef(null);

  useEffect(() => {
    let isCurrent = true;

    async function loadTemplates() {
      setStatus('loading');
      setMessage('');

      try {
        const library = await fetchCustomerTemplateLibrary();

        if (isCurrent) {
          setTemplateLibrary(library);
          setStatus('ready');
        }
      } catch (error) {
        if (isCurrent) {
          setStatus('error');
          setMessage(error.message || 'Unable to load ready-made designs.');
        }
      }
    }

    loadTemplates();

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    if (viewMode !== 'review' || !turnstileSiteKey) {
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
  }, [viewMode]);

  const filteredTemplates = useMemo(() => {
    const visibleTemplates = templateLibrary.templates.filter(template => template.visible);

    if (selectedCategory === 'all') {
      return visibleTemplates;
    }

    if (selectedCategory === 'featured') {
      return visibleTemplates.filter(template => template.featured);
    }

    return visibleTemplates.filter(template => template.categoryId === selectedCategory);
  }, [selectedCategory, templateLibrary.templates]);

  const featuredTemplates = filteredTemplates.filter(template => template.featured);
  const standardTemplates = filteredTemplates.filter(template => !template.featured);
  const hasTemplates = filteredTemplates.length > 0;
  const totalQuantity = getTotalQuantity(cartItems);

  const resetCaptcha = () => {
    if (window.turnstile && widgetIdRef.current) {
      window.turnstile.reset(widgetIdRef.current);
    }
    setCaptchaToken('');
    setCaptchaReady(!turnstileSiteKey);
  };

  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
    setSelectedQuantity(1);
    setSubmitError('');
    setViewMode('detail');
  };

  const handleQuantityChange = (nextQuantity) => {
    setSelectedQuantity(Math.max(1, nextQuantity));
  };

  const handleAddToOrder = () => {
    if (!selectedTemplate) {
      return;
    }

    setCartItems(prevItems => {
      const existingItem = prevItems.find(item => item.id === selectedTemplate.id);

      if (existingItem) {
        return prevItems.map(item => (
          item.id === selectedTemplate.id
            ? { ...item, quantity: item.quantity + selectedQuantity }
            : item
        ));
      }

      return [
        ...prevItems,
        {
          id: selectedTemplate.id,
          templateNumber: selectedTemplate.templateNumber,
          title: selectedTemplate.title,
          imageUrl: selectedTemplate.imageUrl,
          shape: getTemplateShape(selectedTemplate),
          quantity: selectedQuantity,
        },
      ];
    });
    setViewMode('browse');
    setSelectedTemplate(null);
    setSelectedQuantity(1);
  };

  const handleUpdateCartQuantity = (templateId, nextQuantity) => {
    if (nextQuantity < 1) {
      setCartItems(prevItems => prevItems.filter(item => item.id !== templateId));
      return;
    }

    setCartItems(prevItems => prevItems.map(item => (
      item.id === templateId ? { ...item, quantity: nextQuantity } : item
    )));
  };

  const handleRemoveCartItem = (templateId) => {
    setCartItems(prevItems => prevItems.filter(item => item.id !== templateId));
  };

  const handleContinueShopping = () => {
    setSubmitError('');
    setViewMode('browse');
  };

  const handleViewCart = () => {
    setSubmitError('');
    setSelectedTemplate(null);
    setViewMode('cart');
  };

  const handleCustomerInfoChange = (event) => {
    const { name, value } = event.target;
    setCustomerInfo(prevInfo => ({ ...prevInfo, [name]: value }));
    if (customerErrors[name]) {
      setCustomerErrors(prevErrors => ({ ...prevErrors, [name]: '' }));
    }
  };

  const validateCustomerInfo = () => {
    const nextErrors = {};

    if (!customerInfo.name.trim()) {
      nextErrors.name = 'Name is required';
    }

    if (!customerInfo.phone.trim()) {
      nextErrors.phone = 'Phone is required';
    } else if (!/^\d{10,}$/.test(customerInfo.phone.replace(/\D/g, ''))) {
      nextErrors.phone = 'Enter a valid phone number';
    }

    if (!customerInfo.email.trim()) {
      nextErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerInfo.email)) {
      nextErrors.email = 'Enter a valid email';
    }

    setCustomerErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleReviewOrder = () => {
    if (cartItems.length === 0) {
      setViewMode('cart');
      return;
    }

    if (validateCustomerInfo()) {
      setSubmitError('');
      resetCaptcha();
      setViewMode('review');
    }
  };

  const handleSubmitOrder = async () => {
    if (turnstileSiteKey && !captchaToken) {
      setSubmitError('Please complete the order verification before submitting.');
      return;
    }

    const order = createReadyMadeOrder(cartItems, customerInfo);
    setIsSubmitting(true);
    setSubmitError('');

    try {
      const emailDelivery = await submitReadyMadeOrder(order, captchaToken || null);
      setSubmittedOrder({ ...order, emailDelivery });
      setCartItems([]);
      setSelectedTemplate(null);
      setSelectedQuantity(1);
      setViewMode('confirmation');
    } catch (error) {
      setSubmitError(error.message || 'Unable to send your order. Please try again.');
      resetCaptcha();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartOver = () => {
    setCustomerInfo(emptyCustomerInfo);
    setCustomerErrors({});
    setSubmitError('');
    setSubmittedOrder(null);
    setViewMode('browse');
  };

  const renderTemplateCard = (template) => (
    <article className={`ready-template-card ready-template-card-${getTemplateShape(template)}`} key={template.id}>
      <button
        type="button"
        className="ready-template-button"
        onClick={() => handleSelectTemplate(template)}
      >
        <MagnetPreview
          imageUrl={template.imageUrl}
          title={template.title}
          shape={getTemplateShape(template)}
          size="card"
        />
        <span className="template-number">{template.templateNumber}</span>
        {template.featured && <span className="featured-badge">Featured</span>}
      </button>
      <div className="ready-template-body">
        <h3>{template.title}</h3>
        <p>Template #{template.templateNumber}</p>
        <span className="shape-badge">
          {getTemplateShape(template) === 'round' ? 'Round Magnet' : 'Rectangle Magnet'}
        </span>
      </div>
    </article>
  );

  const renderOrderItem = (item, allowEditing = false) => (
    <article className="ready-order-row" key={item.id || item.templateNumber}>
      {item.imageUrl && (
        <MagnetPreview
          imageUrl={item.imageUrl}
          title={item.title}
          shape={item.shape}
          size="list"
        />
      )}
      <div>
        <strong>{item.title}</strong>
        <span>Template #{item.templateNumber}</span>
        <span>Quantity: {item.quantity}</span>
      </div>
      {allowEditing && (
        <>
          <div className="cart-quantity-controls" aria-label={`${item.title} quantity`}>
            <button
              type="button"
              onClick={() => handleUpdateCartQuantity(item.id, item.quantity - 1)}
            >
              -
            </button>
            <span>{item.quantity}</span>
            <button
              type="button"
              onClick={() => handleUpdateCartQuantity(item.id, item.quantity + 1)}
            >
              +
            </button>
          </div>
          <button
            type="button"
            className="remove-template-button"
            onClick={() => handleRemoveCartItem(item.id)}
          >
            Remove
          </button>
        </>
      )}
    </article>
  );

  if (viewMode === 'confirmation' && submittedOrder) {
    return (
      <div className="ready-made-screen">
        <div className="ready-made-content ready-confirmation-content">
          <div className="success-icon">✓</div>
          <h1>Thank You for Your Order!</h1>
          <p className="ready-confirmation-message">
            Jennifer will contact you to confirm pickup and payment.
          </p>

          <section className="ready-summary-panel">
            <h2>Customer Details</h2>
            <p><strong>Name:</strong> {submittedOrder.customerInfo.name}</p>
            <p><strong>Phone:</strong> {submittedOrder.customerInfo.phone}</p>
            <p><strong>Email:</strong> {submittedOrder.customerInfo.email}</p>
          </section>

          <section className="ready-summary-panel">
            <h2>Ordered Templates</h2>
            <div className="ready-order-list">
              {submittedOrder.readyMadeItems.map(item => renderOrderItem(item))}
            </div>
            <p className="ready-total-line">Total Magnets: {submittedOrder.totalQuantity}</p>
          </section>

          <button type="button" className="ready-primary-button" onClick={handleStartOver}>
            Shop More Designs
          </button>
        </div>
      </div>
    );
  }

  if (viewMode === 'review') {
    return (
      <div className="ready-made-screen">
        <div className="ready-made-content ready-review-content">
          <header className="ready-made-header">
            <button type="button" className="back-button ready-back-button" onClick={() => setViewMode('customer')}>
              Back
            </button>
            <div>
              <h1>Review Ready-Made Order</h1>
              <p>{totalQuantity} total magnets</p>
            </div>
          </header>

          <section className="ready-summary-panel">
            <h2>Customer</h2>
            <p><strong>Name:</strong> {customerInfo.name}</p>
            <p><strong>Phone:</strong> {customerInfo.phone}</p>
            <p><strong>Email:</strong> {customerInfo.email}</p>
          </section>

          <section className="ready-summary-panel">
            <h2>Ready-Made Order Contents</h2>
            <div className="ready-order-list">
              {cartItems.map(item => renderOrderItem(item))}
            </div>
            <p className="ready-total-line">Total Magnets: {totalQuantity}</p>
          </section>

          <p className="ready-payment-note">
            No online payment is required. Jennifer will contact you after submission to confirm pickup and payment.
          </p>

          {submitError && (
            <div className="ready-made-message is-error" role="alert">
              {submitError}
            </div>
          )}

          {turnstileSiteKey && (
            <div className="order-verification">
              <div ref={captchaRef} className="turnstile-widget" />
            </div>
          )}

          <div className="ready-order-actions">
            <button type="button" className="back-button" onClick={() => setViewMode('customer')} disabled={isSubmitting}>
              Back
            </button>
            <button
              type="button"
              className="ready-primary-button"
              onClick={handleSubmitOrder}
              disabled={isSubmitting || !captchaReady}
            >
              {isSubmitting ? 'Sending Order...' : submitError ? 'Retry Sending Order' : 'Submit Order'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === 'customer') {
    return (
      <div className="ready-made-screen">
        <div className="ready-made-content ready-customer-content">
          <header className="ready-made-header">
            <button type="button" className="back-button ready-back-button" onClick={handleViewCart}>
              Back
            </button>
            <div>
              <h1>Your Information</h1>
              <p>Jennifer will use this to confirm your ready-made order.</p>
            </div>
          </header>

          <form className="ready-customer-form">
            <div className="form-group">
              <label htmlFor="readyName">Name *</label>
              <input
                id="readyName"
                name="name"
                type="text"
                value={customerInfo.name}
                onChange={handleCustomerInfoChange}
                className={customerErrors.name ? 'error' : ''}
                placeholder="Jane Smith"
              />
              {customerErrors.name && <span className="error-text">{customerErrors.name}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="readyPhone">Phone *</label>
              <input
                id="readyPhone"
                name="phone"
                type="tel"
                value={customerInfo.phone}
                onChange={handleCustomerInfoChange}
                className={customerErrors.phone ? 'error' : ''}
                placeholder="(555) 123-4567"
              />
              {customerErrors.phone && <span className="error-text">{customerErrors.phone}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="readyEmail">Email *</label>
              <input
                id="readyEmail"
                name="email"
                type="email"
                value={customerInfo.email}
                onChange={handleCustomerInfoChange}
                className={customerErrors.email ? 'error' : ''}
                placeholder="jane@example.com"
              />
              {customerErrors.email && <span className="error-text">{customerErrors.email}</span>}
            </div>
          </form>

          <div className="ready-order-actions">
            <button type="button" className="back-button" onClick={handleViewCart}>
              Back
            </button>
            <button type="button" className="ready-primary-button" onClick={handleReviewOrder}>
              Review Order
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === 'cart') {
    return (
      <div className="ready-made-screen">
        <div className="ready-made-content ready-review-content">
          <header className="ready-made-header">
            <button type="button" className="back-button ready-back-button" onClick={handleContinueShopping}>
              Continue Shopping
            </button>
            <div>
              <h1>Ready-Made Cart</h1>
              <p>{totalQuantity} total magnets</p>
            </div>
          </header>

          {cartItems.length === 0 ? (
            <div className="ready-made-message">
              No ready-made designs have been added yet.
            </div>
          ) : (
            <div className="ready-order-list">
              {cartItems.map(item => renderOrderItem(item, true))}
            </div>
          )}

          <div className="ready-order-actions">
            <button type="button" className="back-button" onClick={handleContinueShopping}>
              Continue Shopping
            </button>
            <button
              type="button"
              className="ready-primary-button"
              onClick={() => setViewMode('customer')}
              disabled={cartItems.length === 0}
            >
              Customer Information
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === 'detail' && selectedTemplate) {
    return (
      <div className="ready-made-screen">
        <div className="ready-made-content ready-detail-content">
          <header className="ready-made-header">
            <div>
              <h1>{selectedTemplate.title}</h1>
              <p>Preview Your Magnet</p>
            </div>
          </header>

          <section className="ready-template-detail">
            <div className="ready-template-product-stage">
              <MagnetPreview
                imageUrl={selectedTemplate.imageUrl}
                title={selectedTemplate.title}
                shape={getTemplateShape(selectedTemplate)}
                size="detail"
              />
              <p>What you see is what you receive.</p>
            </div>
            <div className="ready-template-detail-panel">
              <span className="detail-template-number">Template #{selectedTemplate.templateNumber}</span>
              <h2>{selectedTemplate.title}</h2>
              <div className="detail-quantity-control">
                <span>Quantity</span>
                <div className="cart-quantity-controls">
                  <button
                    type="button"
                    onClick={() => handleQuantityChange(selectedQuantity - 1)}
                    disabled={selectedQuantity === 1}
                  >
                    -
                  </button>
                  <span>{selectedQuantity}</span>
                  <button type="button" onClick={() => handleQuantityChange(selectedQuantity + 1)}>
                    +
                  </button>
                </div>
              </div>
              <button type="button" className="ready-primary-button" onClick={handleAddToOrder}>
                Add To Order
              </button>
              <button
                type="button"
                className="ready-secondary-button"
                onClick={handleViewCart}
                disabled={cartItems.length === 0}
              >
                View Order ({totalQuantity})
              </button>
              <button type="button" className="ready-gallery-back-button" onClick={handleContinueShopping}>
                ← Back to Templates
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="ready-made-screen">
      <div className="ready-made-content">
        <header className="ready-made-header">
          <button type="button" className="back-button ready-back-button" onClick={onBack}>
            Back
          </button>
          <div>
            <h1>Ready-Made Designs</h1>
            <p>Browse pre-made magnet designs.</p>
          </div>
          <button
            type="button"
            className="ready-cart-button"
            onClick={handleViewCart}
            disabled={cartItems.length === 0}
          >
            View Order ({totalQuantity})
          </button>
        </header>

        <div className="category-filter-bar" aria-label="Ready-made design categories">
          <button
            type="button"
            className={selectedCategory === 'all' ? 'filter-chip is-active' : 'filter-chip'}
            onClick={() => setSelectedCategory('all')}
          >
            All
          </button>
          <button
            type="button"
            className={selectedCategory === 'featured' ? 'filter-chip is-active' : 'filter-chip'}
            onClick={() => setSelectedCategory('featured')}
          >
            Featured
          </button>
          {templateLibrary.categories.map(category => (
            <button
              type="button"
              className={selectedCategory === category.id ? 'filter-chip is-active' : 'filter-chip'}
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
            >
              {category.name}
            </button>
          ))}
        </div>

        {status === 'loading' && (
          <div className="ready-made-message" role="status">
            Loading ready-made designs...
          </div>
        )}

        {status === 'error' && (
          <div className="ready-made-message is-error" role="alert">
            {message}
          </div>
        )}

        {status === 'ready' && !hasTemplates && (
          <div className="ready-made-message">
            No ready-made designs are available yet.
          </div>
        )}

        {status === 'ready' && featuredTemplates.length > 0 && (
          <section className="template-section">
            <h2>Featured</h2>
            <div className="ready-template-grid">
              {featuredTemplates.map(renderTemplateCard)}
            </div>
          </section>
        )}

        {status === 'ready' && standardTemplates.length > 0 && (
          <section className="template-section">
            <h2>{featuredTemplates.length > 0 ? 'More Designs' : 'Designs'}</h2>
            <div className="ready-template-grid">
              {standardTemplates.map(renderTemplateCard)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
