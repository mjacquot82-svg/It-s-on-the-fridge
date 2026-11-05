import { useState } from 'react';
import { useOrder } from '../context/useOrder';
import '../styles/OrderDetails.css';

export default function OrderDetails({ onNext, onBack }) {
  const { order, setCustomerInfo } = useOrder();
  const [formData, setFormData] = useState({
    ...order.customerInfo,
    quantity: order.quantity || 1,
  });
  const [errors, setErrors] = useState({});
  const hasSavedDesigns = (order.designs || []).length > 0;

  const validateForm = () => {
    const newErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone is required';
    } else if (!/^\d{10,}$/.test(formData.phone.replace(/\D/g, ''))) {
      newErrors.phone = 'Enter a valid phone number';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Enter a valid email';
    }
    if (formData.quantity < 1 || formData.quantity > 100) {
      newErrors.quantity = 'Quantity must be between 1 and 100';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleQuantityChange = (e) => {
    const value = Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1));
    setFormData(prev => ({ ...prev, quantity: value }));
  };

  const handleNext = () => {
    if (validateForm()) {
      setCustomerInfo(formData);
      onNext();
    }
  };

  const handleBack = () => {
    setCustomerInfo(formData);
    onBack();
  };

  return (
    <div className="order-details-screen">
      <div className="details-content">
        <h1>Your Information</h1>
        <p className="subtitle">
          {hasSavedDesigns
            ? 'Confirm your contact details and the quantity for this magnet design.'
            : 'Jennifer will use this to confirm your order.'}
        </p>

        <form className="customer-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="firstName">First Name *</label>
              <input
                id="firstName"
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                placeholder="John"
                className={errors.firstName ? 'error' : ''}
              />
              {errors.firstName && <span className="error-text">{errors.firstName}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="lastName">Last Name *</label>
              <input
                id="lastName"
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                placeholder="Doe"
                className={errors.lastName ? 'error' : ''}
              />
              {errors.lastName && <span className="error-text">{errors.lastName}</span>}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="phone">Phone Number *</label>
            <input
              id="phone"
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              placeholder="(555) 123-4567"
              className={errors.phone ? 'error' : ''}
            />
            {errors.phone && <span className="error-text">{errors.phone}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address *</label>
            <input
              id="email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="john@example.com"
              className={errors.email ? 'error' : ''}
            />
            {errors.email && <span className="error-text">{errors.email}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="quantity">Quantity for this design *</label>
            <div className="quantity-selector">
              <button
                type="button"
                onClick={() => handleQuantityChange({
                  target: { value: formData.quantity - 1 },
                })}
                className="qty-btn"
              >
                −
              </button>
              <input
                id="quantity"
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleQuantityChange}
                min="1"
                max="100"
                className={errors.quantity ? 'error' : ''}
              />
              <button
                type="button"
                onClick={() => handleQuantityChange({
                  target: { value: formData.quantity + 1 },
                })}
                className="qty-btn"
              >
                +
              </button>
            </div>
            {errors.quantity && <span className="error-text">{errors.quantity}</span>}
            <p className="payment-note" style={{ marginTop: '8px' }}>
              You can add more different designs on the next screen. Copies of this same design use quantity.
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="notes">Notes (Optional)</label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              placeholder="Any special requests or comments..."
              className="notes-input"
            />
          </div>
        </form>

        <p className="payment-note details-payment-note">
          No online payment is required. Jennifer will contact you after submission to confirm pickup and payment.
        </p>

        <div className="action-buttons">
          <button className="back-button" onClick={handleBack}>
            Back
          </button>
          <button className="next-button" onClick={handleNext}>
            Review Order
          </button>
        </div>
      </div>
    </div>
  );
}
