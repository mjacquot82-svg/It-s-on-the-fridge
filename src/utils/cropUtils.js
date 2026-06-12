/**
 * Generates a cropped image canvas based on crop coordinates
 */
export async function generateCroppedImage(imageSrc, crop, magnetType) {
  return new Promise((resolve) => {
    const image = new Image();
    image.src = imageSrc;
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Get natural dimensions
      const naturalWidth = image.naturalWidth;
      const naturalHeight = image.naturalHeight;

      if (magnetType === 'round') {
        // Create circular crop
        const size = Math.min(naturalWidth, naturalHeight);
        canvas.width = size;
        canvas.height = size;

        // Calculate crop position in natural image dimensions
        const cropX = (crop.x / 100) * naturalWidth;
        const cropY = (crop.y / 100) * naturalHeight;

        // Create circular mask
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.clip();

        // Draw cropped portion
        ctx.drawImage(
          image,
          cropX,
          cropY,
          size,
          size,
          0,
          0,
          size,
          size
        );
      } else {
        // Rectangle crop (standard aspect ratio)
        const width = naturalWidth;
        const height = naturalHeight;
        canvas.width = width;
        canvas.height = height;

        const cropX = (crop.x / 100) * naturalWidth;
        const cropY = (crop.y / 100) * naturalHeight;

        ctx.drawImage(
          image,
          cropX,
          cropY,
          width,
          height,
          0,
          0,
          width,
          height
        );
      }

      resolve(canvas.toDataURL('image/png'));
    };
  });
}

/**
 * Get display dimensions for preview container based on magnet type
 */
export function getPreviewDimensions(magnetType) {
  if (magnetType === 'round') {
    return {
      width: 300,
      height: 300,
      aspectRatio: 1,
      borderRadius: '50%',
    };
  } else {
    // Rectangle - standard postcard size ratio (4:6)
    return {
      width: 280,
      height: 420,
      aspectRatio: 280 / 420,
      borderRadius: '8px',
    };
  }
}

/**
 * Convert crop percentage to actual pixel values
 */
export function cropPercentToPixels(cropPercent, imageDimensions) {
  return {
    x: (cropPercent.x / 100) * imageDimensions.width,
    y: (cropPercent.y / 100) * imageDimensions.height,
  };
}

/**
 * Read file as data URL
 */
export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
