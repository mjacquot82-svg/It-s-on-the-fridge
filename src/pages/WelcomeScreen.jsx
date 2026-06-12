import '../styles/WelcomeScreen.css';

export default function WelcomeScreen({ onNext }) {
  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <div className="welcome-logo">
          <div className="brand-mark" aria-hidden="true">
            <span>IOF</span>
          </div>
        </div>
        
        <h1>It's On The Fridge</h1>
        <p className="welcome-tagline">Turn your favorite photo into a custom fridge magnet.</p>
        <p className="local-note">Custom photo magnets made locally by Jennifer Jacquot.</p>
        
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
      </div>
    </div>
  );
}
