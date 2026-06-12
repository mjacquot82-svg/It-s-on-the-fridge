/* global process */

const RESEND_API_URL = 'https://api.resend.com/emails';
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_ORIGINAL_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_CROPPED_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 12 * 1024 * 1024;
const RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
const RATE_LIMIT_MAX_REQUESTS = 5;
const EMAIL_RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
const EMAIL_RATE_LIMIT_MAX_REQUESTS = 3;

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getHeader(req, name) {
  const headers = req.headers || {};
  const value = headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()];
  return Array.isArray(value) ? value[0] : value;
}

function getClientIp(req) {
  const forwardedFor = getHeader(req, 'x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  return getHeader(req, 'x-real-ip') || req.socket?.remoteAddress || 'unknown';
}

function normalizeRateLimitKey(value) {
  return String(value || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9@._:-]/g, '_')
    .slice(0, 120);
}

function getDecodedBase64Bytes(base64Value) {
  const padding = base64Value.endsWith('==') ? 2 : base64Value.endsWith('=') ? 1 : 0;
  return Math.floor((base64Value.length * 3) / 4) - padding;
}

function parseDataUrl(dataUrl, fallbackName, maxBytes) {
  if (!dataUrl || typeof dataUrl !== 'string') {
    throw createHttpError(`Missing ${fallbackName}`, 400);
  }

  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw createHttpError(`Invalid ${fallbackName} data`, 400);
  }

  const mimeType = match[1];
  const content = match[2];
  const sizeBytes = getDecodedBase64Bytes(content);
  const extension = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'png';

  if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
    throw createHttpError(`${fallbackName} must be a JPG, PNG, or WebP image`, 415);
  }

  if (sizeBytes > maxBytes) {
    throw createHttpError(`${fallbackName} is too large`, 413);
  }

  return {
    content,
    filename: `${fallbackName}.${extension}`,
    contentType: mimeType,
    sizeBytes,
  };
}

async function runUpstashCommand(command) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  const response = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !Array.isArray(data)) {
    throw createHttpError('Rate limiting is unavailable.', 503);
  }

  return data;
}

function isRateLimitingEnabled() {
  const hasUrl = Boolean(process.env.UPSTASH_REDIS_REST_URL);
  const hasToken = Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);

  if (hasUrl && hasToken) {
    return true;
  }

  console.warn('Upstash Redis is not fully configured; order rate limiting is disabled.');
  return false;
}

async function enforceRateLimit(key, limit, windowSeconds) {
  const safeKey = normalizeRateLimitKey(key);
  const redisKey = `order-submit:${safeKey}`;
  const result = await runUpstashCommand([
    ['INCR', redisKey],
    ['EXPIRE', redisKey, windowSeconds],
  ]);
  const count = Number(result[0]?.result || 0);

  if (count > limit) {
    throw createHttpError('Too many order attempts. Please wait a few minutes and try again.', 429);
  }
}

async function verifyTurnstileToken(token, clientIp) {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    console.warn('TURNSTILE_SECRET_KEY is not configured; order CAPTCHA verification is disabled.');
    return;
  }

  if (!token || typeof token !== 'string') {
    throw createHttpError('Please complete the order verification before submitting.', 403);
  }

  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      secret,
      response: token,
      remoteip: clientIp,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    throw createHttpError('Order verification failed. Please try again.', 403);
  }
}

function buildHtml(order) {
  const { customerInfo } = order;
  const magnetType = order.magnetType === 'round' ? 'Round Magnet' : 'Rectangle Magnet';
  const submittedAt = new Date(order.submittedAt).toLocaleString();

  return `
    <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.45;">
      <div style="border-bottom: 4px solid #667eea; padding-bottom: 14px; margin-bottom: 20px;">
        <h1 style="margin: 0; font-size: 26px;">It's On The Fridge</h1>
        <p style="margin: 6px 0 0; color: #666;">New custom magnet order</p>
      </div>

      <h2 style="font-size: 18px;">Customer</h2>
      <p><strong>Name:</strong> ${escapeHtml(customerInfo.firstName)} ${escapeHtml(customerInfo.lastName)}</p>
      <p><strong>Email:</strong> ${escapeHtml(customerInfo.email)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(customerInfo.phone)}</p>
      <p><strong>Notes:</strong> ${escapeHtml(customerInfo.notes || 'None')}</p>

      <h2 style="font-size: 18px;">Order</h2>
      <p><strong>Magnet Type:</strong> ${escapeHtml(magnetType)}</p>
      <p><strong>Quantity:</strong> ${escapeHtml(customerInfo.quantity)}</p>
      <p><strong>Order ID:</strong> ${escapeHtml(order.id)}</p>
      <p><strong>Submitted:</strong> ${escapeHtml(submittedAt)}</p>

      <h2 style="font-size: 18px;">Attached Images</h2>
      <p><strong>Original Customer Photo:</strong> the photo the customer uploaded.</p>
      <p><strong>Print-Ready Magnet Image:</strong> the cropped image Jennifer should use for printing.</p>

      <div style="background: #fffdf7; border-left: 4px solid #d9bf72; padding: 12px; margin-top: 18px;">
        Jennifer will contact the customer to confirm pickup and payment.
      </div>
    </div>
  `;
}

function buildText(order) {
  const { customerInfo } = order;
  const magnetType = order.magnetType === 'round' ? 'Round Magnet' : 'Rectangle Magnet';
  const submittedAt = new Date(order.submittedAt).toLocaleString();

  return [
    "It's On The Fridge",
    'New custom magnet order',
    '',
    'Customer:',
    `Name: ${customerInfo.firstName} ${customerInfo.lastName}`,
    `Email: ${customerInfo.email}`,
    `Phone: ${customerInfo.phone}`,
    `Notes: ${customerInfo.notes || 'None'}`,
    '',
    'Order:',
    `Magnet Type: ${magnetType}`,
    `Quantity: ${customerInfo.quantity}`,
    `Order ID: ${order.id}`,
    `Submitted: ${submittedAt}`,
    '',
    'Attached Images:',
    '- Original Customer Photo: the photo the customer uploaded.',
    '- Print-Ready Magnet Image: the cropped image Jennifer should use for printing.',
    '',
    'Jennifer will contact the customer to confirm pickup and payment.',
  ].join('\n');
}

function validateOrder(order) {
  if (!order || typeof order !== 'object') {
    throw createHttpError('Missing order', 400);
  }

  if (!order.customerInfo) {
    throw createHttpError('Missing customer information', 400);
  }

  const { customerInfo } = order;

  if (!customerInfo.firstName?.trim()) {
    throw createHttpError('First name is required', 400);
  }

  if (!customerInfo.lastName?.trim()) {
    throw createHttpError('Last name is required', 400);
  }

  if (!/^\d{10,}$/.test(String(customerInfo.phone || '').replace(/\D/g, ''))) {
    throw createHttpError('A valid phone number is required', 400);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(customerInfo.email || ''))) {
    throw createHttpError('A valid email address is required', 400);
  }

  const quantity = Number(customerInfo.quantity);
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 100) {
    throw createHttpError('Quantity must be between 1 and 100', 400);
  }

  if (!order.photo || !order.croppedImage) {
    throw createHttpError('Missing order image attachments', 400);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.JENNIFER_EMAIL;
  const from = process.env.RESEND_FROM_EMAIL;
  const clientIp = getClientIp(req);

  if (!apiKey || !to || !from) {
    return sendJson(res, 500, {
      error: 'Email delivery is not configured. Missing RESEND_API_KEY, JENNIFER_EMAIL, or RESEND_FROM_EMAIL.',
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { order, turnstileToken } = body || {};
    validateOrder(order);

    if (isRateLimitingEnabled()) {
      await enforceRateLimit(`ip:${clientIp}`, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_SECONDS);
      await enforceRateLimit(`email:${order.customerInfo.email}`, EMAIL_RATE_LIMIT_MAX_REQUESTS, EMAIL_RATE_LIMIT_WINDOW_SECONDS);
    }

    await verifyTurnstileToken(turnstileToken, clientIp);

    const originalImage = parseDataUrl(order.photo, `order-${order.id}-original`, MAX_ORIGINAL_IMAGE_BYTES);
    const croppedImage = parseDataUrl(order.croppedImage, `order-${order.id}-print`, MAX_CROPPED_IMAGE_BYTES);

    if (originalImage.sizeBytes + croppedImage.sizeBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
      throw createHttpError('Order images are too large. Please upload a smaller photo and try again.', 413);
    }

    const customerName = `${order.customerInfo.firstName} ${order.customerInfo.lastName}`.trim();

    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        reply_to: order.customerInfo.email,
        subject: `New Magnet Order - ${customerName || order.id}`,
        html: buildHtml(order),
        text: buildText(order),
        attachments: [
          {
            content: originalImage.content,
            filename: `Original Customer Photo.${originalImage.filename.split('.').pop()}`,
            contentType: originalImage.contentType,
          },
          {
            content: croppedImage.content,
            filename: `Print-Ready Magnet Image.${croppedImage.filename.split('.').pop()}`,
            contentType: croppedImage.contentType,
          },
        ],
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return sendJson(res, response.status, {
        error: data.message || 'Resend could not deliver the order email.',
      });
    }

    return sendJson(res, 200, {
      id: data.id,
      provider: 'resend',
      sentAt: new Date().toISOString(),
    });
  } catch (error) {
    return sendJson(res, error.statusCode || 400, {
      error: error.message || 'Unable to send order email.',
    });
  }
}
