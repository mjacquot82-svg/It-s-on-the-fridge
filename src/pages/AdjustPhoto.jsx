import { useState, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import { useOrder } from '../context/OrderContext';
import { generateCroppedImage, getImageDimensions, getPreviewDimensions } from '../utils/cropUtils';
import '../styles/AdjustPhoto.css';

export default function AdjustPhoto({ onNext }) {
  const {
    order,
    setCrop,
    setCroppedAreaPixels,
    setZoom,
    setCroppedImage,
    setCropVerification,
  } = useOrder();
  const [zoom, setLocalZoom] = useState(order.zoom || 1);
  const [crop, setLocalCrop] = useState(order.crop || { x: 0, y: 0 });
  const [croppedPixels, setLocalCroppedPixels] = useState(order.croppedAreaPixels);
  const [previewImage, setPreviewImage] = useState(order.croppedImage);
  const [isGenerating, setIsGenerating] = useState(false);

  const dimensions = getPreviewDimensions(order.magnetType);

  const handleCropChange = (newCrop) => {
    setLocalCrop(newCrop);
    setCrop(newCrop);
  };

  const handleZoomChange = useCallback((newZoom) => {
    setLocalZoom(newZoom);
    setZoom(newZoom);
  }, [setZoom]);

  const handleZoomByWheel = useCallback(
    (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      const newZoom = Math.min(Math.max(zoom + delta, 1), 3);
      handleZoomChange(newZoom);
    },
    [handleZoomChange, zoom]
  );

  const handleCropComplete = useCallback((_, croppedAreaPixels) => {
    setLocalCroppedPixels(croppedAreaPixels);
    setCroppedAreaPixels(croppedAreaPixels);
  }, [setCroppedAreaPixels]);

  useEffect(() => {
    if (!order.photo || !croppedPixels) {
      return;
    }

    let isCurrent = true;
    const previewTimer = window.setTimeout(async () => {
      try {
        const generatedPreview = await generateCroppedImage(
          order.photo,
          croppedPixels,
          order.magnetType
        );

        if (isCurrent) {
          setPreviewImage(generatedPreview);
        }
      } catch (error) {
        console.error('Error generating crop preview:', error);
      }
    }, 150);

    return () => {
      isCurrent = false;
      window.clearTimeout(previewTimer);
    };
  }, [order.photo, order.magnetType, croppedPixels]);

  const handleNext = async () => {
    if (!croppedPixels) {
      alert('Please wait for the crop preview to finish loading.');
      return;
    }

    setIsGenerating(true);
    try {
      const croppedImage = await generateCroppedImage(
        order.photo,
        croppedPixels,
        order.magnetType
      );
      const generatedDimensions = await getImageDimensions(croppedImage);
      const cropVerification = {
        magnetType: order.magnetType,
        cropPosition: crop,
        zoom,
        croppedAreaPixels: croppedPixels,
        generatedImage: generatedDimensions,
        matchesCropperPixels:
          generatedDimensions.width === Math.round(croppedPixels.width) &&
          generatedDimensions.height === Math.round(croppedPixels.height),
      };

      setCroppedImage(croppedImage);
      setCropVerification(cropVerification);
      console.info('Crop verification', cropVerification);
      onNext();
    } catch (error) {
      console.error('Error generating cropped image:', error);
      alert('Error processing image. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!order.photo) {
    return (
      <div className="adjust-photo-screen">
        <div className="adjust-content">
          <h1>Photo Needed</h1>
          <p className="subtitle">
            Please go back and upload your photo again to continue adjusting your magnet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="adjust-photo-screen">
      <div className="adjust-content">
        <h1>Adjust Your Photo</h1>
        <p className="subtitle">Crop your photo</p>

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
            onCropComplete={handleCropComplete}
          />
        </div>

        <div className="warning-message">
          <p>Everything visible inside the preview will be printed.</p>
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
            {order.photo && croppedPixels && previewImage ? (
              <img 
                src={previewImage} 
                alt="Preview" 
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <div className="preview-loading">Preparing preview...</div>
            )}
          </div>
          <p className="preview-label">Print Preview</p>
        </div>

        <div className="action-buttons">
          <button 
            className="next-button" 
            onClick={handleNext}
            disabled={isGenerating || !croppedPixels}
          >
            {isGenerating ? 'Processing...' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
