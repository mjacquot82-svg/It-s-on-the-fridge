import logo from '../assets/logo.png';
import { useOrder } from '../context/useOrder';
import { formatCurrency } from '../utils/pricing';
import '../styles/WelcomeScreen.css';

export default function WelcomeScreen({ onNext }) {
  const { pricingSettings } = useOrder();

  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <div className="welcome-logo">
          <img src={logo} alt="It's On The Fridge Magnets" className="brand-logo" />
        </div>
        
        <h1>It's On The Fridge</h1>
        <p className="welcome-tagline">Turn your favorite photo into a custom fridge magnet.</p>
        <p className="local-note">Custom photo magnets made locally by Jennifer Jacquot.</p>

        <div className="price-list">
          <div className="price-item">
            <span>Round Magnet</span>
            <strong>{formatCurrency(pricingSettings.roundMagnetPrice)}</strong>
          </div>
          <div className="price-item">
            <span>Rectangle Magnet</span>
            <strong>{formatCurrency(pricingSettings.rectangleMagnetPrice)}</strong>
          </div>
        </div>

        {pricingSettings.promotionEnabled && pricingSettings.promotionText && (
          <section className="promotion-card" aria-label="Current promotion">
            <span className="promotion-icon" aria-hidden="true">%</span>
            <div className="promotion-copy">
              <h2>Special Offer</h2>
              <p>{pricingSettings.promotionText}</p>
            </div>
          </section>
        )}
        
        <ol className="process-list">
          <li>Choose your magnet shape</li>
          <li>Upload and crop your photo</li>
          <li>Submit your order</li>
          <li>Jennifer will contact you to confirm pickup and payment</li>
        </ol>

        <p className="payment-note">
          No online payment is required. Jennifer will contact you after submission to confirm your order.
        </p>

        <button className="cta-button" onClick={onNext}>
          Start Your Magnet
        </button>

        <a className="settings-link" href="#settings">
          Jennifer Settings
        </a>
      </div>
    </div>
  );
}
