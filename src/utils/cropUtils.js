function createImage(imageSrc) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = imageSrc;
  });
}

const OPTIMIZED_IMAGE_TYPE = 'image/jpeg';
const OPTIMIZED_IMAGE_QUALITY = 0.86;
const OPTIMIZED_MAX_LONG_EDGE = 1800;
const OPTIMIZED_TARGET_BYTES = 1.2 * 1024 * 1024;
const OPTIMIZED_MAX_BYTES = 1.8 * 1024 * 1024;
const MIN_PRINT_LONG_EDGE = 900;

function getBase64PayloadSize(dataUrl) {
  const base64Value = dataUrl.split(',')[1] || '';
  const padding = base64Value.endsWith('==') ? 2 : base64Value.endsWith('=') ? 1 : 0;
  return Math.floor((base64Value.length * 3) / 4) - padding;
}

function canvasToDataUrl(canvas, type, quality) {
  return canvas.toDataURL(type, quality);
}

function drawImageToCanvas(image, maxLongEdge) {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const scale = Math.min(1, maxLongEdge / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(image, 0, 0, width, height);

  return { canvas, width, height };
}

/**
 * Compresses customer uploads before they enter order state so the final
 * serverless request remains small enough for production order submission.
 */
export async function optimizeImageFile(file) {
  if (!file?.type?.startsWith('image/')) {
    throw new Error('Please choose a photo file.');
  }

  const originalDataUrl = await readFileAsDataUrl(file);
  const originalBytes = file.size || getBase64PayloadSize(originalDataUrl);
  const image = await createImage(originalDataUrl);
  const originalWidth = image.naturalWidth || image.width;
  const originalHeight = image.naturalHeight || image.height;
  let maxLongEdge = OPTIMIZED_MAX_LONG_EDGE;
  let quality = OPTIMIZED_IMAGE_QUALITY;
  let optimizedDataUrl = '';
  let optimizedWidth = 0;
  let optimizedHeight = 0;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { canvas, width, height } = drawImageToCanvas(image, maxLongEdge);
    optimizedDataUrl = canvasToDataUrl(canvas, OPTIMIZED_IMAGE_TYPE, quality);
    optimizedWidth = width;
    optimizedHeight = height;

    const optimizedBytes = getBase64PayloadSize(optimizedDataUrl);
    if (optimizedBytes <= OPTIMIZED_TARGET_BYTES || maxLongEdge <= MIN_PRINT_LONG_EDGE) {
      break;
    }

    if (quality > 0.78) {
      quality -= 0.04;
    } else {
      maxLongEdge = Math.max(MIN_PRINT_LONG_EDGE, Math.round(maxLongEdge * 0.86));
    }
  }

  const optimizedBytes = getBase64PayloadSize(optimizedDataUrl);

  if (optimizedBytes > OPTIMIZED_MAX_BYTES) {
    throw new Error('This photo is still too large to submit. Please choose a smaller photo or take a screenshot of the photo and upload that instead.');
  }

  return {
    dataUrl: optimizedDataUrl,
    originalBytes,
    optimizedBytes,
    originalWidth,
    originalHeight,
    optimizedWidth,
    optimizedHeight,
    mimeType: OPTIMIZED_IMAGE_TYPE,
  };
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
