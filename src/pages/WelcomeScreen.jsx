import logo from '../assets/logo.png';
import { useOrder } from '../context/useOrder';
import { formatCurrency } from '../utils/pricing';
import '../styles/WelcomeScreen.css';

export default function WelcomeScreen({ onNext, onBrowseReadyMade }) {
  const { pricingSettings } = useOrder();

  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <div className="welcome-logo">
          <img src={logo} alt="It's On The Fridge Magnets" className="brand-logo" />
        </div>
        
        <h1>It's On The Fridge</h1>
        <p className="welcome-tagline">Turn your favorite photo into a custom fridge magnet.</p>
        <p className="local-note">Custom photo magnets made locally by the Jacquot family.</p>

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
        
        <div className="welcome-options">
          <button className="welcome-option-card" type="button" onClick={onNext}>
            <span>Create Your Own Magnet</span>
            <small>Upload your own photo</small>
          </button>
          <button className="welcome-option-card" type="button" onClick={onBrowseReadyMade}>
            <span>Shop Ready-Made Designs</span>
            <small>Browse pre-made magnet designs</small>
          </button>
        </div>

        <a className="settings-link" href="#settings">
          Jennifer Settings
        </a>
      </div>
    </div>
  );
}
