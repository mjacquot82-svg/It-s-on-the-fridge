import { useEffect, useMemo, useState } from 'react';
import {
  emptyCustomerTemplateLibrary,
  fetchCustomerTemplateLibrary,
} from '../utils/templates';
import '../styles/ReadyMadeDesigns.css';

export default function ReadyMadeDesigns({ onBack }) {
  const [templateLibrary, setTemplateLibrary] = useState(emptyCustomerTemplateLibrary);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [cartItems, setCartItems] = useState([]);
  const [viewMode, setViewMode] = useState('browse');
  const [checkoutMessage, setCheckoutMessage] = useState('');

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
  const totalQuantity = cartItems.reduce((total, item) => total + item.quantity, 0);

  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
    setSelectedQuantity(1);
    setCheckoutMessage('');
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
    setCheckoutMessage('');
    setViewMode('browse');
  };

  const handleViewOrder = () => {
    setCheckoutMessage('');
    setSelectedTemplate(null);
    setViewMode('review');
  };

  const handlePlaceholderCheckout = () => {
    setCheckoutMessage('Ready-made order submission coming next.');
  };

  const renderTemplateCard = (template) => (
    <article className="ready-template-card" key={template.id}>
      <button
        type="button"
        className="ready-template-button"
        onClick={() => handleSelectTemplate(template)}
      >
        <img src={template.imageUrl} alt={template.title} />
        <span className="template-number">{template.templateNumber}</span>
        {template.featured && <span className="featured-badge">Featured</span>}
      </button>
      <div className="ready-template-body">
        <h3>{template.title}</h3>
        <p>{template.templateNumber}</p>
      </div>
    </article>
  );

  if (viewMode === 'review') {
    return (
      <div className="ready-made-screen">
        <div className="ready-made-content ready-review-content">
          <header className="ready-made-header">
            <button type="button" className="back-button ready-back-button" onClick={handleContinueShopping}>
              Continue Shopping
            </button>
            <div>
              <h1>Ready-Made Order</h1>
              <p>{totalQuantity} total magnets</p>
            </div>
          </header>

          {cartItems.length === 0 ? (
            <div className="ready-made-message">
              No ready-made designs have been added yet.
            </div>
          ) : (
            <div className="ready-order-list">
              {cartItems.map(item => (
                <article className="ready-order-row" key={item.id}>
                  <img src={item.imageUrl} alt={item.title} />
                  <div>
                    <strong>
                      {item.templateNumber} {item.title} x {item.quantity}
                    </strong>
                    <span>{item.templateNumber}</span>
                  </div>
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
                </article>
              ))}
            </div>
          )}

          {checkoutMessage && (
            <div className="template-placeholder-message" role="status">
              {checkoutMessage}
            </div>
          )}

          <div className="ready-order-actions">
            <button type="button" className="back-button" onClick={handleContinueShopping}>
              Continue Shopping
            </button>
            <button
              type="button"
              className="ready-primary-button"
              onClick={handlePlaceholderCheckout}
              disabled={cartItems.length === 0}
            >
              Checkout
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
            <button type="button" className="back-button ready-back-button" onClick={handleContinueShopping}>
              Continue Shopping
            </button>
            <div>
              <h1>{selectedTemplate.title}</h1>
              <p>{selectedTemplate.templateNumber}</p>
            </div>
          </header>

          <section className="ready-template-detail">
            <img src={selectedTemplate.imageUrl} alt={selectedTemplate.title} />
            <div className="ready-template-detail-panel">
              <span className="detail-template-number">{selectedTemplate.templateNumber}</span>
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
                onClick={handleViewOrder}
                disabled={cartItems.length === 0}
              >
                View Order ({totalQuantity})
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
            onClick={handleViewOrder}
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
