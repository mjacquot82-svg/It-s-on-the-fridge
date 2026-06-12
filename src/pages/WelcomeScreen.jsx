import React from 'react';
import { useOrder } from '../context/OrderContext';
import '../styles/WelcomeScreen.css';

export default function WelcomeScreen({ onNext }) {
  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <div className="welcome-logo">
          <div className="logo-placeholder">🧲</div>
        </div>
        
        <h1>It's On The Fridge</h1>
        <p className="welcome-tagline">Create Custom Magnets</p>
        
        <div className="welcome-features">
          <div className="feature">
            <div className="feature-icon">📸</div>
            <p>Upload your photo</p>
          </div>
          <div className="feature">
            <div className="feature-icon">✨</div>
            <p>Perfect your design</p>
          </div>
          <div className="feature">
            <div className="feature-icon">🎁</div>
            <p>Order magnets</p>
          </div>
        </div>

        <button className="cta-button" onClick={onNext}>
          Get Started
        </button>
      </div>
    </div>
  );
}
