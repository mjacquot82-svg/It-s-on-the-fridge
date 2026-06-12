import React, { useState, useCallback, useRef } from 'react';
import Cropper from 'react-easy-crop';
import { useOrder } from '../context/OrderContext';
import { generateCroppedImage, getPreviewDimensions } from '../utils/cropUtils';
import '../styles/AdjustPhoto.css';

export default function AdjustPhoto({ onNext }) {
  const { order, setCrop, setZoom, setCroppedImage } = useOrder();
  const [zoom, setLocalZoom] = useState(order.zoom || 1);
  const [crop, setLocalCrop] = useState(order.crop || { x: 0, y: 0 });
  const [isGenerating, setIsGenerating] = useState(false);
  const cropperRef = useRef(null);

  const dimensions = getPreviewDimensions(order.magnetType);

  const handleCropChange = (newCrop) => {
    setLocalCrop(newCrop);
    setCrop(newCrop);
  };

  const handleZoomChange = (newZoom) => {
    setLocalZoom(newZoom);
    setZoom(newZoom);
  };

  const handleZoomByWheel = useCallback(
    (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      const newZoom = Math.min(Math.max(zoom + delta, 1), 3);
      handleZoomChange(newZoom);
    },
    [zoom]
  );

  const handleNext = async () => {
    setIsGenerating(true);
    try {
      const croppedImage = await generateCroppedImage(
        order.photo,
        crop,
        order.magnetType
      );
      setCroppedImage(croppedImage);
      onNext();
    } catch (error) {
      console.error('Error generating cropped image:', error);
      alert('Error processing image. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="adjust-photo-screen">
      <div className="adjust-content">
        <h1>Adjust Your Photo</h1>
        <p className="subtitle">Position your image perfectly</p>

        <div className="cropper-container" onWheel={handleZoomByWheel}>
          <Cropper
            image={order.photo}
            crop={crop}
            zoom={zoom}
            aspect={dimensions.aspectRatio}
            cropShape={order.magnetType === 'round' ? 'round' : 'rect'}
            showGrid={true}
            onCropChange={handleCropChange}
            onZoomChange={handleZoomChange}
            onCropAreaChange={() => {}}
          />
        </div>

        <div className="warning-message">
          <p>⚠️ Everything visible inside the preview will be printed.</p>
        </div>

        <div className="zoom-controls">
          <label htmlFor="zoom">Zoom: {Math.round(zoom * 100)}%</label>
          <input
            id="zoom"
            type="range"
            min="1"
            max="3"
            step="0.05"
            value={zoom}
            onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
            className="zoom-slider"
          />
        </div>

        <div className="preview-info">
          <div className="preview-box" style={{ 
            width: `${dimensions.width}px`,
            height: `${dimensions.height}px`,
            borderRadius: dimensions.borderRadius,
          }}>
            <img 
              src={order.photo} 
              alt="Preview" 
              style={{
                transform: `translate(-${crop.x}%, -${crop.y}%) scale(${zoom})`,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </div>
          <p className="preview-label">This is how it will look</p>
        </div>

        <div className="action-buttons">
          <button 
            className="next-button" 
            onClick={handleNext}
            disabled={isGenerating}
          >
            {isGenerating ? 'Processing...' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
