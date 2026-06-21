import { useMemo } from 'react';
import logo from '../assets/logo.png';
import '../styles/InstallPage.css';

const INSTALL_URL = 'https://itsonthefridge.appthat.ca/install';

function getDeviceType() {
  const ua = navigator.userAgent || navigator.vendor || '';
  const platform = navigator.platform || '';
  const hasTouch = navigator.maxTouchPoints > 1;

  if (/android/i.test(ua)) return 'android';
  if (/iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && hasTouch)) return 'ios';
  return 'desktop';
}

const instructions = {
  ios: {
    title: 'Install on iPhone',
    steps: ['Open in Safari', 'Tap the Share button', 'Tap Add to Home Screen', 'Tap Add'],
  },
  android: {
    title: 'Install on Android',
    steps: ['Open in Chrome', 'Tap the menu (⋮)', 'Tap Install App or Add to Home Screen', 'Tap Install'],
  },
};

const features = [
  ['Create', 'Upload your favorite photo'],
  ['Customize', 'Adjust and preview your magnet'],
  ['Order', 'Place your order directly from your phone'],
];

export default function InstallPage({ onStartDesigning }) {
  const deviceType = useMemo(() => getDeviceType(), []);
  const deviceInstructions = instructions[deviceType];

  return (
    <main className="install-page">
      <section className="install-hero" aria-labelledby="install-title">
        <div className="install-brand">
          <img src={logo} alt="It's On The Fridge Magnets" />
        </div>

        <div className="install-copy">
          <h1 id="install-title">Turn Your Favorite Photos Into Custom Fridge Magnets</h1>
          <p>Install the app on your phone and start designing in seconds.</p>
        </div>

        <button className="install-primary-button" type="button" onClick={onStartDesigning}>
          Start Designing
        </button>
      </section>

      <section className="install-card" aria-label="Installation instructions">
        {deviceInstructions ? (
          <>
            <div className="install-card-heading">
              <span className="install-kicker">{deviceType === 'ios' ? 'iPhone / iPad' : 'Android'}</span>
              <h2>{deviceInstructions.title}</h2>
            </div>
            <ol className="install-steps">
              {deviceInstructions.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p className="install-check">✓ No App Store Required</p>
          </>
        ) : (
          <div className="install-desktop">
            <div className="install-card-heading">
              <span className="install-kicker">Desktop</span>
              <h2>Install on Your Phone</h2>
            </div>
            <a className="install-qr-wrap" href={INSTALL_URL} aria-label="Open install QR code destination">
              <img src="/install-assets/install-qr.svg" alt={`QR code pointing to ${INSTALL_URL}`} />
            </a>
            <p className="install-scan-text">Scan to Install &amp; Start Designing</p>
          </div>
        )}
      </section>

      <section className="install-features" aria-label="How it works">
        {features.map(([title, body]) => (
          <article className="install-feature" key={title}>
            <span aria-hidden="true">{title.slice(0, 1)}</span>
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
