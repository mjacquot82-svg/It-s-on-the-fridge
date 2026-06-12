import { useMemo, useState } from 'react';
import { OrderProvider } from './context/OrderContext';
import { useOrder } from './context/useOrder';
import WelcomeScreen from './pages/WelcomeScreen';
import MagnetTypeSelection from './pages/MagnetTypeSelection';
import UploadPhoto from './pages/UploadPhoto';
import AdjustPhoto from './pages/AdjustPhoto';
import OrderDetails from './pages/OrderDetails';
import ReviewOrder from './pages/ReviewOrder';
import OrderSubmitted from './pages/OrderSubmitted';
import './App.css';

function AppContent() {
  const { resetOrder } = useOrder();
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

  const pageProps = { onNext: handleNext, onBack: handleBack };

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
