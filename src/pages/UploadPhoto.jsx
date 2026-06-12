import { useRef, useState } from 'react';
import { useOrder } from '../context/OrderContext';
import { optimizeImageFile } from '../utils/cropUtils';
import '../styles/UploadPhoto.css';

export default function UploadPhoto({ onNext }) {
  const { setPhoto } = useOrder();
  const fileInputRef = useRef(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadError('');
      setIsOptimizing(true);

      try {
        const optimizedImage = await optimizeImageFile(file);
        console.info('Image optimized for order submission', {
          originalBytes: optimizedImage.originalBytes,
          optimizedBytes: optimizedImage.optimizedBytes,
          originalSize: `${optimizedImage.originalWidth}x${optimizedImage.originalHeight}`,
          optimizedSize: `${optimizedImage.optimizedWidth}x${optimizedImage.optimizedHeight}`,
        });
        setPhoto(optimizedImage.dataUrl);
        onNext();
      } catch (error) {
        setUploadError(error.message || 'We could not prepare this photo. Please try a smaller image.');
      } finally {
        setIsOptimizing(false);
        e.target.value = '';
      }
    }
  };

  return (
    <div className="upload-screen">
      <div className="upload-content">
        <h1>Upload Your Photo</h1>
        <p className="subtitle">Choose the photo Jennifer will use for your custom magnet.</p>

        <div className="upload-area">
          <div className="upload-icon" aria-hidden="true"></div>
          <p className="upload-text">Tap to select a photo</p>
          <button
            className="upload-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isOptimizing}
          >
            {isOptimizing ? 'Preparing Photo...' : 'Choose Photo'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoSelect}
            className="hidden-input"
          />
        </div>

        {uploadError && (
          <div className="upload-error" role="alert">
            {uploadError}
          </div>
        )}

        <div className="upload-tips">
          <h3>Tips for best results:</h3>
          <ul>
            <li>Use a clear, well-lit photo</li>
            <li>Large phone photos will be prepared automatically</li>
            <li>Portrait or landscape photos both work</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
