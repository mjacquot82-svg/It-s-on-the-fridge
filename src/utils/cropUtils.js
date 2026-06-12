function createImage(imageSrc) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = imageSrc;
  });
}

/**
 * Generates the final image from react-easy-crop's croppedAreaPixels output.
 */
export async function generateCroppedImage(imageSrc, croppedAreaPixels, magnetType) {
  if (!croppedAreaPixels) {
    throw new Error('Missing croppedAreaPixels from cropper');
  }

  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const outputWidth = Math.round(croppedAreaPixels.width);
  const outputHeight = Math.round(croppedAreaPixels.height);

  canvas.width = outputWidth;
  canvas.height = outputHeight;

  if (magnetType === 'round') {
    ctx.save();
    ctx.beginPath();
    ctx.arc(outputWidth / 2, outputHeight / 2, Math.min(outputWidth, outputHeight) / 2, 0, Math.PI * 2);
    ctx.clip();
  }

  ctx.drawImage(
    image,
    Math.round(croppedAreaPixels.x),
    Math.round(croppedAreaPixels.y),
    outputWidth,
    outputHeight,
    0,
    0,
    outputWidth,
    outputHeight
  );

  if (magnetType === 'round') {
    ctx.restore();
  }

  return canvas.toDataURL('image/png');
}

export function getImageDimensions(imageSrc) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };
    image.onerror = reject;
    image.src = imageSrc;
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
