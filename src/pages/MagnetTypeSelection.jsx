import { useOrder } from '../context/OrderContext';
import '../styles/MagnetTypeSelection.css';

export default function MagnetTypeSelection({ onNext }) {
  const { setMagnetType } = useOrder();

  const handleSelectType = (type) => {
    setMagnetType(type);
    onNext();
  };

  return (
    <div className="magnet-type-screen">
      <div className="type-content">
        <h1>Choose Your Magnet Shape</h1>
        <p className="subtitle">Pick the shape that works best for your photo.</p>

        <div className="type-options">
          <button
            className="type-option round"
            onClick={() => handleSelectType('round')}
          >
            <div className="type-preview round-preview">
              <div className="circle"></div>
            </div>
            <h2>Round Magnet</h2>
            <p>Great for faces, pets, and centered photos</p>
          </button>

          <button
            className="type-option rectangle"
            onClick={() => handleSelectType('rectangle')}
          >
            <div className="type-preview rectangle-preview">
              <div className="rectangle"></div>
            </div>
            <h2>Rectangle Magnet</h2>
            <p>Great for full photos and wider layouts</p>
          </button>
        </div>
      </div>
    </div>
  );
}
