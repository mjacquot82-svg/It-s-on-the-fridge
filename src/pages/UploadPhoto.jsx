import React, { useRef } from 'react';
import { useOrder } from '../context/OrderContext';
import { readFileAsDataUrl } from '../utils/cropUtils';
import '../styles/UploadPhoto.css';

export default function UploadPhoto({ onNext }) {
  const { setPhoto } = useOrder();
  const fileInputRef = useRef(null);

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const dataUrl = await readFileAsDataUrl(file);
      setPhoto(dataUrl);
      onNext();
    }
  };

  return (
    <div className="upload-screen">
      <div className="upload-content">
        <h1>Upload Your Photo</h1>
        <p className="subtitle">Choose a photo from your phone or device</p>

        <div className="upload-area">
          <div className="upload-icon">📷</div>
          <p className="upload-text">Tap to select a photo</p>
          <button
            className="upload-button"
            onClick={() => fileInputRef.current?.click()}
          >
            Choose Photo
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoSelect}
            className="hidden-input"
          />
        </div>

        <div className="upload-tips">
          <h3>Tips for best results:</h3>
          <ul>
            <li>Use a clear, well-lit photo</li>
            <li>Avoid very small photos</li>
            <li>Portrait or landscape both work</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
