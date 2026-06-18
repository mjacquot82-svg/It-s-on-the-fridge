/* global process, Buffer */

const RESEND_API_URL = 'https://api.resend.com/emails';
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const ORDERS_TABLE = 'orders';
const ORDER_ITEMS_TABLE = 'order_items';
const ORDER_IMAGES_TABLE = 'order_images';
const ORDER_IMAGES_BUCKET = 'order-images';
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

function getSupabaseConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function getSupabaseHeaders(serviceRoleKey) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };
}

function getFileExtension(contentType) {
  if (contentType === 'image/png') {
    return 'png';
  }

  if (contentType === 'image/webp') {
    return 'webp';
  }

  return 'jpg';
}

function createPublicOrderNumber() {
  const datePart = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const randomPart = crypto.randomUUID().split('-')[0].toUpperCase();
  return `IOF-${datePart}-${randomPart}`;
}

function getOrderType(order) {
  return order.orderType === 'ready-made' ? 'ready_made' : 'custom_photo';
}

function getCustomerName(order) {
  if (order.orderType === 'ready-made') {
    return order.customerInfo.name.trim();
  }

  return `${order.customerInfo.firstName} ${order.customerInfo.lastName}`.trim();
}

function sanitizeCustomOrderPayload(order) {
  return {
    id: order.id,
    submittedAt: order.submittedAt,
    magnetType: order.magnetType === 'round' ? 'round' : 'rectangle',
    crop: order.crop || null,
    croppedAreaPixels: order.croppedAreaPixels || null,
    zoom: order.zoom || null,
    cropVerification: order.cropVerification || null,
    customerInfo: order.customerInfo,
  };
}

function sanitizeReadyMadeOrderPayload(order) {
  return {
    id: order.id,
    submittedAt: order.submittedAt,
    orderType: order.orderType,
    customerInfo: order.customerInfo,
    readyMadeItems: order.readyMadeItems.map(item => ({
      templateNumber: item.templateNumber,
      title: item.title,
      quantity: item.quantity,
      imageUrl: item.imageUrl || null,
    })),
    totalQuantity: order.totalQuantity,
  };
}

function buildOrderRecord(order, publicOrderNumber) {
  const isReadyMadeOrder = order.orderType === 'ready-made';
  const customerInfo = order.customerInfo;
  const totalQuantity = isReadyMadeOrder
    ? Number(order.totalQuantity)
    : Number(customerInfo.quantity);

  return {
    public_order_number: publicOrderNumber,
    order_type: getOrderType(order),
    email_status: 'received',
    customer_name: getCustomerName(order),
    customer_first_name: isReadyMadeOrder ? null : customerInfo.firstName,
    customer_last_name: isReadyMadeOrder ? null : customerInfo.lastName,
    customer_email: customerInfo.email,
    customer_phone: customerInfo.phone,
    customer_notes: isReadyMadeOrder ? null : customerInfo.notes || null,
    total_quantity: totalQuantity,
    magnet_type: isReadyMadeOrder ? null : (order.magnetType === 'round' ? 'round' : 'rectangle'),
    order_payload: isReadyMadeOrder ? sanitizeReadyMadeOrderPayload(order) : sanitizeCustomOrderPayload(order),
    submitted_at: order.submittedAt || new Date().toISOString(),
  };
}

function buildReadyMadeItemRows(orderId, order) {
  return order.readyMadeItems.map(item => ({
    order_id: orderId,
    template_number: item.templateNumber,
    template_title: item.title,
    template_image_url: item.imageUrl || null,
    quantity: Number(item.quantity),
  }));
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
    buffer: Buffer.from(content, 'base64'),
    filename: `${fallbackName}.${extension}`,
    contentType: mimeType,
    sizeBytes,
  };
}

async function fetchSupabaseJson(url, options, fallbackError) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw createHttpError(data?.message || data?.error || fallbackError, response.status || 500);
  }

  return data;
}

async function createDurableOrder(supabaseUrl, serviceRoleKey, order) {
  const baseUrl = supabaseUrl.replace(/\/$/, '');
  const publicOrderNumber = createPublicOrderNumber();
  const endpoint = `${baseUrl}/rest/v1/${ORDERS_TABLE}?select=id,public_order_number,email_status`;
  const rows = await fetchSupabaseJson(endpoint, {
    method: 'POST',
    headers: {
      ...getSupabaseHeaders(serviceRoleKey),
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(buildOrderRecord(order, publicOrderNumber)),
  }, 'Unable to save order before sending email.');

  if (!rows[0]?.id) {
    throw createHttpError('Supabase did not return a saved order id.', 500);
  }

  return {
    id: rows[0].id,
    publicOrderNumber: rows[0].public_order_number,
    emailStatus: rows[0].email_status,
  };
}

async function updateOrderEmailStatus(supabaseUrl, serviceRoleKey, orderId, patch) {
  const baseUrl = supabaseUrl.replace(/\/$/, '');
  const endpoint = new URL(`${baseUrl}/rest/v1/${ORDERS_TABLE}`);
  endpoint.searchParams.set('id', `eq.${orderId}`);

  await fetchSupabaseJson(endpoint, {
    method: 'PATCH',
    headers: {
      ...getSupabaseHeaders(serviceRoleKey),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(patch),
  }, 'Unable to update order email status.');
}

async function insertOrderItems(supabaseUrl, serviceRoleKey, orderId, order) {
  const rows = buildReadyMadeItemRows(orderId, order);

  if (rows.length === 0) {
    return;
  }

  const baseUrl = supabaseUrl.replace(/\/$/, '');
  await fetchSupabaseJson(`${baseUrl}/rest/v1/${ORDER_ITEMS_TABLE}`, {
    method: 'POST',
    headers: {
      ...getSupabaseHeaders(serviceRoleKey),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(rows),
  }, 'Unable to save ready-made order items.');
}

async function uploadOrderImage(supabaseUrl, serviceRoleKey, orderId, imageType, image) {
  const baseUrl = supabaseUrl.replace(/\/$/, '');
  const extension = getFileExtension(image.contentType);
  const fileName = imageType === 'original' ? `original.${extension}` : `print-ready.${extension}`;
  const objectPath = `orders/${orderId}/${fileName}`;
  const uploadUrl = `${baseUrl}/storage/v1/object/${ORDER_IMAGES_BUCKET}/${objectPath}`;
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      ...getSupabaseHeaders(serviceRoleKey),
      'Content-Type': image.contentType,
      'x-upsert': 'false',
    },
    body: image.buffer,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw createHttpError(errorText || `Unable to upload ${imageType} order image.`, response.status || 500);
  }

  return {
    order_id: orderId,
    image_type: imageType,
    bucket: ORDER_IMAGES_BUCKET,
    object_path: objectPath,
    content_type: image.contentType,
    size_bytes: image.sizeBytes,
  };
}

async function insertOrderImages(supabaseUrl, serviceRoleKey, imageRows) {
  if (imageRows.length === 0) {
    return;
  }

  const baseUrl = supabaseUrl.replace(/\/$/, '');
  await fetchSupabaseJson(`${baseUrl}/rest/v1/${ORDER_IMAGES_TABLE}`, {
    method: 'POST',
    headers: {
      ...getSupabaseHeaders(serviceRoleKey),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(imageRows),
  }, 'Unable to save order image records.');
}

async function saveCustomOrderImages(supabaseUrl, serviceRoleKey, orderId, originalImage, croppedImage) {
  const imageRows = [];

  imageRows.push(await uploadOrderImage(supabaseUrl, serviceRoleKey, orderId, 'original', originalImage));
  imageRows.push(await uploadOrderImage(supabaseUrl, serviceRoleKey, orderId, 'print_ready', croppedImage));
  await insertOrderImages(supabaseUrl, serviceRoleKey, imageRows);
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
  if (order.orderType === 'ready-made') {
    return buildReadyMadeHtml(order);
  }

  const { customerInfo } = order;
  const magnetType = order.magnetType === 'round' ? 'Round Magnet' : 'Rectangle Magnet';
  const submittedAt = new Date(order.submittedAt).toLocaleString();

  return `
    <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.45;">
      <div style="border-bottom: 4px solid #63c7bd; padding-bottom: 14px; margin-bottom: 20px;">
        <h1 style="margin: 0; font-size: 26px;">It's On The Fridge</h1>
        <p style="margin: 6px 0 0; color: #65737b;">New custom magnet order</p>
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

      <div style="background: #fff8df; border-left: 4px solid #ffe22e; padding: 12px; margin-top: 18px;">
        Jennifer will contact the customer to confirm pickup and payment.
      </div>
    </div>
  `;
}

function buildReadyMadeHtml(order) {
  const { customerInfo } = order;
  const submittedAt = new Date(order.submittedAt).toLocaleString();
  const orderItems = order.readyMadeItems.map(item => (
    `<li>
      ${escapeHtml(item.templateNumber)} ${escapeHtml(item.title)} x ${escapeHtml(item.quantity)}
      ${item.imageUrl ? `<br><a href="${escapeHtml(item.imageUrl)}">Template image</a>` : ''}
    </li>`
  )).join('');

  return `
    <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.45;">
      <div style="border-bottom: 4px solid #63c7bd; padding-bottom: 14px; margin-bottom: 20px;">
        <h1 style="margin: 0; font-size: 26px;">It's On The Fridge</h1>
        <p style="margin: 6px 0 0; color: #65737b;">New ready-made magnet order</p>
      </div>

      <h2 style="font-size: 18px;">Customer</h2>
      <p><strong>Name:</strong> ${escapeHtml(customerInfo.name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(customerInfo.email)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(customerInfo.phone)}</p>

      <h2 style="font-size: 18px;">Ready-Made Order Contents</h2>
      <ul>${orderItems}</ul>
      <p><strong>Total Magnets:</strong> ${escapeHtml(order.totalQuantity)}</p>
      <p><strong>Order ID:</strong> ${escapeHtml(order.id)}</p>
      <p><strong>Submitted:</strong> ${escapeHtml(submittedAt)}</p>

      <div style="background: #fff8df; border-left: 4px solid #ffe22e; padding: 12px; margin-top: 18px;">
        Jennifer will contact the customer to confirm pickup and payment.
      </div>
    </div>
  `;
}

function buildText(order) {
  if (order.orderType === 'ready-made') {
    return buildReadyMadeText(order);
  }

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

function buildReadyMadeText(order) {
  const { customerInfo } = order;
  const submittedAt = new Date(order.submittedAt).toLocaleString();
  const orderItems = order.readyMadeItems.map(item => (
    `${item.templateNumber} ${item.title} x ${item.quantity}${item.imageUrl ? `\n  Template image: ${item.imageUrl}` : ''}`
  ));

  return [
    "It's On The Fridge",
    'New ready-made magnet order',
    '',
    'Customer:',
    `Name: ${customerInfo.name}`,
    `Email: ${customerInfo.email}`,
    `Phone: ${customerInfo.phone}`,
    '',
    'Ready-Made Order Contents:',
    ...orderItems,
    '',
    `Total Magnets: ${order.totalQuantity}`,
    `Order ID: ${order.id}`,
    `Submitted: ${submittedAt}`,
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

  if (order.orderType === 'ready-made') {
    validateReadyMadeOrder(order);
    return;
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

function validateReadyMadeOrder(order) {
  const { customerInfo } = order;

  if (!customerInfo.name?.trim()) {
    throw createHttpError('Name is required', 400);
  }

  if (!/^\d{10,}$/.test(String(customerInfo.phone || '').replace(/\D/g, ''))) {
    throw createHttpError('A valid phone number is required', 400);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(customerInfo.email || ''))) {
    throw createHttpError('A valid email address is required', 400);
  }

  if (!Array.isArray(order.readyMadeItems) || order.readyMadeItems.length === 0) {
    throw createHttpError('At least one ready-made template is required', 400);
  }

  const totalQuantity = order.readyMadeItems.reduce((total, item) => {
    if (!item.templateNumber?.trim()) {
      throw createHttpError('Template number is required', 400);
    }

    if (!item.title?.trim()) {
      throw createHttpError('Template title is required', 400);
    }

    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      throw createHttpError('Template quantity must be between 1 and 100', 400);
    }

    return total + quantity;
  }, 0);

  if (totalQuantity < 1 || totalQuantity > 100) {
    throw createHttpError('Total magnet quantity must be between 1 and 100', 400);
  }

  if (Number(order.totalQuantity) !== totalQuantity) {
    throw createHttpError('Ready-made order total does not match item quantities', 400);
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
  const { url: supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const clientIp = getClientIp(req);

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { order, turnstileToken } = body || {};
    validateOrder(order);

    if (isRateLimitingEnabled()) {
      await enforceRateLimit(`ip:${clientIp}`, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_SECONDS);
      await enforceRateLimit(`email:${order.customerInfo.email}`, EMAIL_RATE_LIMIT_MAX_REQUESTS, EMAIL_RATE_LIMIT_WINDOW_SECONDS);
    }

    await verifyTurnstileToken(turnstileToken, clientIp);

    const attachments = [];
    const isReadyMadeOrder = order.orderType === 'ready-made';
    const customerName = isReadyMadeOrder
      ? order.customerInfo.name.trim()
      : `${order.customerInfo.firstName} ${order.customerInfo.lastName}`.trim();
    let originalImage = null;
    let croppedImage = null;

    if (!isReadyMadeOrder) {
      originalImage = parseDataUrl(order.photo, `order-${order.id}-original`, MAX_ORIGINAL_IMAGE_BYTES);
      croppedImage = parseDataUrl(order.croppedImage, `order-${order.id}-print`, MAX_CROPPED_IMAGE_BYTES);

      if (originalImage.sizeBytes + croppedImage.sizeBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
        throw createHttpError('Order images are too large. Please upload a smaller photo and try again.', 413);
      }

      attachments.push(
        {
          content: originalImage.content,
          filename: `Original Customer Photo.${originalImage.filename.split('.').pop()}`,
          contentType: originalImage.contentType,
        },
        {
          content: croppedImage.content,
          filename: `Print-Ready Magnet Image.${croppedImage.filename.split('.').pop()}`,
          contentType: croppedImage.contentType,
        }
      );
    }

    let durableOrder = null;
    let durableOrderSaved = false;

    if (!supabaseUrl || !serviceRoleKey) {
      console.warn('Durable order storage is not configured; falling back to email-only order delivery.');
    } else {
      try {
        durableOrder = await createDurableOrder(supabaseUrl, serviceRoleKey, order);

        if (isReadyMadeOrder) {
          await insertOrderItems(supabaseUrl, serviceRoleKey, durableOrder.id, order);
        } else {
          await saveCustomOrderImages(supabaseUrl, serviceRoleKey, durableOrder.id, originalImage, croppedImage);
        }

        await updateOrderEmailStatus(supabaseUrl, serviceRoleKey, durableOrder.id, {
          email_status: 'email_pending',
          email_error: null,
        });
        durableOrderSaved = true;
      } catch (error) {
        console.warn('Durable order storage failed; falling back to email-only order delivery.', {
          error: error.message || 'Unknown durable order storage error.',
        });

        if (durableOrder?.id) {
          await updateOrderEmailStatus(supabaseUrl, serviceRoleKey, durableOrder.id, {
            email_status: 'email_failed',
            email_error: error.message || 'Unable to finish durable order storage.',
          }).catch(() => {});
        }

        durableOrder = null;
      }
    }

    if (!apiKey || !to || !from) {
      const emailError = 'Email delivery is not configured. Missing RESEND_API_KEY, JENNIFER_EMAIL, or RESEND_FROM_EMAIL.';
      if (durableOrderSaved) {
        await updateOrderEmailStatus(supabaseUrl, serviceRoleKey, durableOrder.id, {
          email_status: 'email_failed',
          email_error: emailError,
        });

        return sendJson(res, 200, {
          orderId: durableOrder.id,
          publicOrderNumber: durableOrder.publicOrderNumber,
          emailStatus: 'email_failed',
          durableOrderSaved: true,
        });
      }

      return sendJson(res, 500, {
        error: `${emailError} Durable order storage was unavailable, so this order was not saved.`,
        durableOrderSaved: false,
      });
    }

    const emailOrder = {
      ...order,
      clientOrderId: order.id,
      id: durableOrderSaved ? durableOrder.publicOrderNumber : order.id,
      durableOrderId: durableOrderSaved ? durableOrder.id : null,
    };

    let response;
    let data = {};

    try {
      response = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to,
          reply_to: order.customerInfo.email,
          subject: `${isReadyMadeOrder ? 'New Ready-Made Magnet Order' : 'New Magnet Order'} - ${customerName || emailOrder.id}`,
          html: buildHtml(emailOrder),
          text: buildText(emailOrder),
          ...(attachments.length > 0 ? { attachments } : {}),
        }),
      });

      data = await response.json().catch(() => ({}));
    } catch (error) {
      if (durableOrderSaved) {
        await updateOrderEmailStatus(supabaseUrl, serviceRoleKey, durableOrder.id, {
          email_status: 'email_failed',
          email_error: error.message || 'Unable to reach Resend.',
        });

        return sendJson(res, 200, {
          orderId: durableOrder.id,
          publicOrderNumber: durableOrder.publicOrderNumber,
          emailStatus: 'email_failed',
          durableOrderSaved: true,
        });
      }

      return sendJson(res, 502, {
        error: `Unable to reach Resend, and durable order storage was unavailable. ${error.message || ''}`.trim(),
        durableOrderSaved: false,
      });
    }

    if (!response.ok) {
      const emailError = data.message || 'Resend could not deliver the order email.';
      if (durableOrderSaved) {
        await updateOrderEmailStatus(supabaseUrl, serviceRoleKey, durableOrder.id, {
          email_status: 'email_failed',
          email_error: emailError,
        });

        return sendJson(res, 200, {
          orderId: durableOrder.id,
          publicOrderNumber: durableOrder.publicOrderNumber,
          emailStatus: 'email_failed',
          durableOrderSaved: true,
        });
      }

      return sendJson(res, response.status, {
        error: `${emailError} Durable order storage was unavailable, so this order was not saved.`,
        durableOrderSaved: false,
      });
    }

    if (!durableOrderSaved) {
      return sendJson(res, 200, {
        id: data.id,
        provider: 'resend',
        sentAt: new Date().toISOString(),
        durableOrderSaved: false,
        emailStatus: 'email_sent',
      });
    }

    await updateOrderEmailStatus(supabaseUrl, serviceRoleKey, durableOrder.id, {
      email_status: 'email_sent',
      resend_message_id: data.id || null,
      email_error: null,
    });

    return sendJson(res, 200, {
      orderId: durableOrder.id,
      publicOrderNumber: durableOrder.publicOrderNumber,
      emailStatus: 'email_sent',
      durableOrderSaved: true,
    });
  } catch (error) {
    return sendJson(res, error.statusCode || 400, {
      error: error.message || 'Unable to send order email.',
    });
  }
}
