import { useEffect, useMemo, useState } from 'react';
import { OrderProvider } from './context/OrderContext';
import { useOrder } from './context/useOrder';
import WelcomeScreen from './pages/WelcomeScreen';
import MagnetTypeSelection from './pages/MagnetTypeSelection';
import UploadPhoto from './pages/UploadPhoto';
import AdjustPhoto from './pages/AdjustPhoto';
import OrderDetails from './pages/OrderDetails';
import ReviewOrder from './pages/ReviewOrder';
import OrderSubmitted from './pages/OrderSubmitted';
import SettingsPage from './pages/SettingsPage';
import ReadyMadeDesigns from './pages/ReadyMadeDesigns';
import BuildVersion from './components/BuildVersion';
import './App.css';

function AppContent() {
  const { resetOrder } = useOrder();
  const [isSettingsOpen, setIsSettingsOpen] = useState(() => window.location.hash === '#settings');
  const [isReadyMadeOpen, setIsReadyMadeOpen] = useState(false);
  const pages = useMemo(() => [
    { component: WelcomeScreen, title: 'Welcome' },
    { component: MagnetTypeSelection, title: 'Select Type' },
    { component: UploadPhoto, title: 'Upload Photo' },
    { component: AdjustPhoto, title: 'Adjust Photo' },
    { component: OrderDetails, title: 'Order Details' },
    { component: ReviewOrder, title: 'Review Order' },
    { component: OrderSubmitted, title: 'Submitted' },
  ], []);

  const [currentPage, setCurrentPage] = useState(0);

  const CurrentPage = pages[currentPage].component;

  useEffect(() => {
    const handleHashChange = () => {
      setIsSettingsOpen(window.location.hash === '#settings');
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleNext = () => {
    if (currentPage < pages.length - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleBack = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleRestart = () => {
    resetOrder();
    setCurrentPage(0);
  };

  const pageProps = {
    onNext: handleNext,
    onBack: handleBack,
    onBrowseReadyMade: () => setIsReadyMadeOpen(true),
  };

  if (isSettingsOpen) {
    return (
      <div className="app">
        <SettingsPage
          onExit={() => {
            window.location.hash = '';
            setIsSettingsOpen(false);
          }}
        />
        <BuildVersion />
      </div>
    );
  }

  if (isReadyMadeOpen) {
    return (
      <div className="app">
        <ReadyMadeDesigns onBack={() => setIsReadyMadeOpen(false)} />
      </div>
    );
  }

  return (
    <div className="app">
      {currentPage < pages.length - 1 ? (
        <>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${((currentPage + 1) / (pages.length - 1)) * 100}%` }}
            ></div>
          </div>
          <CurrentPage {...pageProps} />
        </>
      ) : (
        <CurrentPage onRestart={handleRestart} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <OrderProvider>
      <AppContent />
    </OrderProvider>
  );
}
