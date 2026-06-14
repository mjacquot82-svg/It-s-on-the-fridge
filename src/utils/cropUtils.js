function createImage(imageSrc) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = imageSrc;
  });
}

const OPTIMIZED_IMAGE_TYPE = 'image/jpeg';
const OPTIMIZED_IMAGE_QUALITY = 0.88;
const OPTIMIZED_MAX_LONG_EDGE = 2000;
const OPTIMIZED_TARGET_BYTES = 1.85 * 1024 * 1024;
const OPTIMIZED_MAX_BYTES = 2.8 * 1024 * 1024;
const MIN_PRINT_LONG_EDGE = 900;
const SUBMISSION_TARGET_BYTES = 2.75 * 1024 * 1024;
const SUBMISSION_MAX_ESTIMATED_JSON_BYTES = 4.8 * 1024 * 1024;
const CROPPED_TARGET_BYTES = 0.95 * 1024 * 1024;
const CROPPED_MAX_BYTES = 1.5 * 1024 * 1024;

function getBase64PayloadSize(dataUrl) {
  const base64Value = dataUrl.split(',')[1] || '';
  const padding = base64Value.endsWith('==') ? 2 : base64Value.endsWith('=') ? 1 : 0;
  return Math.floor((base64Value.length * 3) / 4) - padding;
}

function logImageDiagnostic(message, details) {
  console.info(`[image-submission] ${message}`, details);
}

function canvasToDataUrl(canvas, type, quality) {
  return canvas.toDataURL(type, quality);
}

export function getDataUrlBytes(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') {
    return 0;
  }

  return getBase64PayloadSize(dataUrl);
}

function getDataUrlMimeType(dataUrl) {
  return dataUrl?.match?.(/^data:([^;]+);base64,/)?.[1] || '';
}

function drawImageToCanvas(image, maxLongEdge, fillStyle = null) {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const scale = Math.min(1, maxLongEdge / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = width;
  canvas.height = height;
  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(image, 0, 0, width, height);

  return { canvas, width, height };
}

function encodeCanvas(canvas, preferredTypes, quality) {
  for (const type of preferredTypes) {
    const dataUrl = canvasToDataUrl(canvas, type, quality);
    if (getDataUrlMimeType(dataUrl) === type) {
      return dataUrl;
    }
  }

  return canvasToDataUrl(canvas, OPTIMIZED_IMAGE_TYPE, quality);
}

async function optimizeDataUrl(dataUrl, {
  maxLongEdge,
  minLongEdge,
  quality,
  minQuality,
  targetBytes,
  maxBytes,
  preferredTypes,
  fillStyle = null,
  diagnosticStage = 'image optimization',
}) {
  const image = await createImage(dataUrl);
  let currentMaxLongEdge = maxLongEdge;
  let currentQuality = quality;
  let optimizedDataUrl = dataUrl;
  let optimizedWidth = image.naturalWidth || image.width;
  let optimizedHeight = image.naturalHeight || image.height;
  let optimizedBytes = getDataUrlBytes(dataUrl);

  for (let attempt = 0; attempt < 14; attempt += 1) {
    const { canvas, width, height } = drawImageToCanvas(image, currentMaxLongEdge, fillStyle);
    optimizedDataUrl = encodeCanvas(canvas, preferredTypes, currentQuality);
    optimizedWidth = width;
    optimizedHeight = height;
    optimizedBytes = getDataUrlBytes(optimizedDataUrl);

    if (optimizedBytes <= targetBytes || (currentMaxLongEdge <= minLongEdge && currentQuality <= minQuality)) {
      break;
    }

    if (currentQuality > minQuality) {
      currentQuality = Math.max(minQuality, currentQuality - 0.05);
    } else {
      currentMaxLongEdge = Math.max(minLongEdge, Math.round(currentMaxLongEdge * 0.88));
    }
  }

  if (optimizedBytes > maxBytes) {
    logImageDiagnostic('rejected during image optimization', {
      stage: diagnosticStage,
      optimizedBytes,
      targetBytes,
      maxBytes,
      optimizedSize: `${optimizedWidth}x${optimizedHeight}`,
    });
    throw new Error('This photo is still too large to submit after preparation. Please choose a smaller photo or crop tighter before trying again.');
  }

  logImageDiagnostic('image optimization complete', {
    stage: diagnosticStage,
    optimizedBytes,
    targetBytes,
    maxBytes,
    optimizedSize: `${optimizedWidth}x${optimizedHeight}`,
    mimeType: getDataUrlMimeType(optimizedDataUrl),
  });

  return {
    dataUrl: optimizedDataUrl,
    optimizedBytes,
    optimizedWidth,
    optimizedHeight,
    mimeType: getDataUrlMimeType(optimizedDataUrl),
  };
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
  const optimized = await optimizeDataUrl(originalDataUrl, {
    maxLongEdge: OPTIMIZED_MAX_LONG_EDGE,
    minLongEdge: MIN_PRINT_LONG_EDGE,
    quality: OPTIMIZED_IMAGE_QUALITY,
    minQuality: 0.74,
    targetBytes: OPTIMIZED_TARGET_BYTES,
    maxBytes: OPTIMIZED_MAX_BYTES,
    preferredTypes: [OPTIMIZED_IMAGE_TYPE],
    fillStyle: '#ffffff',
    diagnosticStage: 'upload optimization',
  });

  return {
    dataUrl: optimized.dataUrl,
    originalBytes,
    optimizedBytes: optimized.optimizedBytes,
    originalWidth,
    originalHeight,
    optimizedWidth: optimized.optimizedWidth,
    optimizedHeight: optimized.optimizedHeight,
    mimeType: optimized.mimeType,
  };
}

function estimateJsonPayloadBytes(photo, croppedImage) {
  return Math.ceil((getDataUrlBytes(photo) + getDataUrlBytes(croppedImage)) * 1.4);
}

export async function optimizeOrderImagesForSubmission(order) {
  const croppedPreferredTypes = [OPTIMIZED_IMAGE_TYPE];

  let photo = order.photo;
  let croppedImage = order.croppedImage;

  logImageDiagnostic('submission image sizes before optimization', {
    stage: 'submission preparation',
    originalImageBytes: getDataUrlBytes(photo),
    croppedImageBytes: getDataUrlBytes(croppedImage),
    estimatedPayloadBytes: estimateJsonPayloadBytes(photo, croppedImage),
  });

  if (getDataUrlBytes(photo) > OPTIMIZED_TARGET_BYTES) {
    photo = (await optimizeDataUrl(photo, {
      maxLongEdge: OPTIMIZED_MAX_LONG_EDGE,
      minLongEdge: MIN_PRINT_LONG_EDGE,
      quality: OPTIMIZED_IMAGE_QUALITY,
      minQuality: 0.72,
      targetBytes: OPTIMIZED_TARGET_BYTES,
      maxBytes: OPTIMIZED_MAX_BYTES,
      preferredTypes: [OPTIMIZED_IMAGE_TYPE],
      fillStyle: '#ffffff',
      diagnosticStage: 'submission original image optimization',
    })).dataUrl;
  }

  if (getDataUrlBytes(croppedImage) > CROPPED_TARGET_BYTES) {
    croppedImage = (await optimizeDataUrl(croppedImage, {
      maxLongEdge: Math.max(1200, Math.max(order.cropVerification?.generatedImage?.width || 0, order.cropVerification?.generatedImage?.height || 0)),
      minLongEdge: MIN_PRINT_LONG_EDGE,
      quality: 0.92,
      minQuality: 0.78,
      targetBytes: CROPPED_TARGET_BYTES,
      maxBytes: CROPPED_MAX_BYTES,
      preferredTypes: croppedPreferredTypes,
      fillStyle: '#ffffff',
      diagnosticStage: 'submission cropped image optimization',
    })).dataUrl;
  }

  while (
    estimateJsonPayloadBytes(photo, croppedImage) > SUBMISSION_TARGET_BYTES &&
    getDataUrlBytes(photo) > OPTIMIZED_TARGET_BYTES * 0.65
  ) {
    photo = (await optimizeDataUrl(photo, {
      maxLongEdge: 1900,
      minLongEdge: MIN_PRINT_LONG_EDGE,
      quality: 0.84,
      minQuality: 0.7,
      targetBytes: Math.max(1.2 * 1024 * 1024, getDataUrlBytes(photo) * 0.82),
      maxBytes: OPTIMIZED_MAX_BYTES,
      preferredTypes: [OPTIMIZED_IMAGE_TYPE],
      fillStyle: '#ffffff',
      diagnosticStage: 'submission original image payload reduction',
    })).dataUrl;
  }

  while (
    estimateJsonPayloadBytes(photo, croppedImage) > SUBMISSION_TARGET_BYTES &&
    getDataUrlBytes(croppedImage) > CROPPED_TARGET_BYTES * 0.7
  ) {
    croppedImage = (await optimizeDataUrl(croppedImage, {
      maxLongEdge: Math.max(1100, Math.max(order.cropVerification?.generatedImage?.width || 0, order.cropVerification?.generatedImage?.height || 0)),
      minLongEdge: MIN_PRINT_LONG_EDGE,
      quality: 0.88,
      minQuality: 0.74,
      targetBytes: Math.max(820 * 1024, getDataUrlBytes(croppedImage) * 0.82),
      maxBytes: CROPPED_MAX_BYTES,
      preferredTypes: croppedPreferredTypes,
      fillStyle: '#ffffff',
      diagnosticStage: 'submission cropped image payload reduction',
    })).dataUrl;
  }

  const estimatedJsonBytes = estimateJsonPayloadBytes(photo, croppedImage);
  if (estimatedJsonBytes > SUBMISSION_MAX_ESTIMATED_JSON_BYTES) {
    logImageDiagnostic('rejected during submission preparation', {
      stage: 'submission estimated payload guard',
      originalImageBytes: getDataUrlBytes(photo),
      croppedImageBytes: getDataUrlBytes(croppedImage),
      estimatedPayloadBytes: estimatedJsonBytes,
      maxEstimatedPayloadBytes: SUBMISSION_MAX_ESTIMATED_JSON_BYTES,
    });
    throw new Error('Your photo is too large to submit from this device after extra preparation. Please crop tighter or choose a smaller photo.');
  }

  logImageDiagnostic('submission image sizes after optimization', {
    stage: 'submission preparation',
    originalImageBytes: getDataUrlBytes(photo),
    croppedImageBytes: getDataUrlBytes(croppedImage),
    estimatedPayloadBytes: estimatedJsonBytes,
    maxEstimatedPayloadBytes: SUBMISSION_MAX_ESTIMATED_JSON_BYTES,
  });

  return {
    ...order,
    photo,
    croppedImage,
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
