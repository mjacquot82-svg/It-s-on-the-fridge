import { useState } from 'react';
import { useOrder } from '../context/useOrder';
import '../styles/SettingsPage.css';

const SETTINGS_PIN = '2468';

export default function SettingsPage({ onExit }) {
  const { pricingSettings, updatePricingSettings } = useOrder();
  const [pin, setPin] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinError, setPinError] = useState('');
  const [formValues, setFormValues] = useState(pricingSettings);
  const [saveMessage, setSaveMessage] = useState('');

  const handleUnlock = (event) => {
    event.preventDefault();
    if (pin === SETTINGS_PIN) {
      setIsUnlocked(true);
      setPinError('');
      return;
    }

    setPinError('Incorrect PIN.');
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setSaveMessage('');
    setFormValues(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSave = (event) => {
    event.preventDefault();
    updatePricingSettings({
      ...formValues,
      roundMagnetPrice: Number(formValues.roundMagnetPrice),
      rectangleMagnetPrice: Number(formValues.rectangleMagnetPrice),
    });
    setSaveMessage('Settings saved.');
  };

  return (
    <div className="settings-screen">
      <div className="settings-content">
        <h1>Settings</h1>
        <p className="subtitle">Update prices and promotions.</p>

        {!isUnlocked ? (
          <form className="settings-form" onSubmit={handleUnlock}>
            <div className="form-group">
              <label htmlFor="settingsPin">PIN</label>
              <input
                id="settingsPin"
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                autoComplete="current-password"
              />
            </div>
            {pinError && <div className="settings-error" role="alert">{pinError}</div>}
            <div className="action-buttons">
              <button type="button" className="back-button" onClick={onExit}>
                Back
              </button>
              <button type="submit" className="next-button">
                Unlock
              </button>
            </div>
          </form>
        ) : (
          <form className="settings-form" onSubmit={handleSave}>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="roundMagnetPrice">Round Magnet Price</label>
                <input
                  id="roundMagnetPrice"
                  name="roundMagnetPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formValues.roundMagnetPrice}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="rectangleMagnetPrice">Rectangle Magnet Price</label>
                <input
                  id="rectangleMagnetPrice"
                  name="rectangleMagnetPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formValues.rectangleMagnetPrice}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="settings-toggle">
              <input
                id="promotionEnabled"
                name="promotionEnabled"
                type="checkbox"
                checked={formValues.promotionEnabled}
                onChange={handleChange}
              />
              <label htmlFor="promotionEnabled">Promotion Enabled</label>
            </div>

            <div className="form-group">
              <label htmlFor="promotionText">Promotion Text</label>
              <textarea
                id="promotionText"
                name="promotionText"
                value={formValues.promotionText}
                onChange={handleChange}
                placeholder="Example: Buy 3 magnets, get 1 free."
              />
            </div>

            {saveMessage && <div className="settings-success" role="status">{saveMessage}</div>}

            <div className="action-buttons">
              <button type="button" className="back-button" onClick={onExit}>
                Back
              </button>
              <button type="submit" className="next-button">
                Save Settings
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
