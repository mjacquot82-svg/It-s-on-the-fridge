/* global process, Buffer */

const CATEGORIES_TABLE = 'template_categories';
const TEMPLATES_TABLE = 'magnet_templates';
const TEMPLATE_BUCKET = 'ready-made-templates';

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function getSupabaseConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function getAuthHeaders(serviceRoleKey) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };
}

function normalizeBoolean(value, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeSortOrder(value) {
  const sortOrder = Number(value);
  return Number.isInteger(sortOrder) ? sortOrder : 0;
}

function normalizeTemplateShape(value) {
  return value === 'round' ? 'round' : 'rectangle';
}

function getRequiredString(value, fieldName) {
  const text = String(value || '').trim();

  if (!text) {
    throw new Error(`${fieldName} is required.`);
  }

  return text;
}

function parseImageDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

  if (!match) {
    throw new Error('Template image must be a valid image upload.');
  }

  return {
    contentType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
}

function getFileExtension(contentType, fileName) {
  const fileNameExtension = String(fileName || '').toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];

  if (fileNameExtension) {
    return fileNameExtension.replace(/[^a-z0-9]/g, '');
  }

  if (contentType === 'image/png') {
    return 'png';
  }

  if (contentType === 'image/webp') {
    return 'webp';
  }

  return 'jpg';
}

function normalizeCategory(row) {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    visible: row.visible,
  };
}

function normalizeTemplate(row) {
  return {
    id: row.id,
    templateNumber: row.template_number,
    title: row.title,
    categoryId: row.category_id,
    categoryName: row.template_categories?.name || '',
    imageUrl: row.image_url,
    shape: normalizeTemplateShape(row.shape),
    visible: row.visible,
    featured: row.featured,
    createdAt: row.created_at,
  };
}

async function fetchJson(url, options, fallbackError) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || data?.error || fallbackError);
  }

  return data;
}

async function loadTemplateLibrary(supabaseUrl, serviceRoleKey) {
  const baseUrl = supabaseUrl.replace(/\/$/, '');
  const headers = getAuthHeaders(serviceRoleKey);
  const categoriesUrl = new URL(`${baseUrl}/rest/v1/${CATEGORIES_TABLE}`);
  categoriesUrl.searchParams.set('select', 'id,name,sort_order,visible');
  categoriesUrl.searchParams.set('order', 'sort_order.asc,name.asc');

  const templatesUrl = new URL(`${baseUrl}/rest/v1/${TEMPLATES_TABLE}`);
  templatesUrl.searchParams.set('select', 'id,template_number,title,category_id,image_url,shape,visible,featured,created_at,template_categories(name)');
  templatesUrl.searchParams.set('order', 'created_at.desc');

  const [categories, templates] = await Promise.all([
    fetchJson(categoriesUrl, { headers }, 'Unable to load template categories.'),
    fetchJson(templatesUrl, { headers }, 'Unable to load magnet templates.'),
  ]);

  return {
    categories: categories.map(normalizeCategory),
    templates: templates.map(normalizeTemplate),
  };
}

async function createCategory(supabaseUrl, serviceRoleKey, body) {
  const baseUrl = supabaseUrl.replace(/\/$/, '');
  const endpoint = `${baseUrl}/rest/v1/${CATEGORIES_TABLE}?select=id,name,sort_order,visible`;
  const rows = await fetchJson(endpoint, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(serviceRoleKey),
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      name: getRequiredString(body.name, 'Category name'),
      sort_order: normalizeSortOrder(body.sortOrder),
      visible: normalizeBoolean(body.visible, true),
    }),
  }, 'Unable to create template category.');

  return normalizeCategory(rows[0]);
}

async function uploadTemplateImage(supabaseUrl, serviceRoleKey, body) {
  const { contentType, buffer } = parseImageDataUrl(body.imageDataUrl);
  const extension = getFileExtension(contentType, body.fileName);
  const objectPath = `templates/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const baseUrl = supabaseUrl.replace(/\/$/, '');
  const uploadUrl = `${baseUrl}/storage/v1/object/${TEMPLATE_BUCKET}/${objectPath}`;
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(serviceRoleKey),
      'Content-Type': contentType,
      'x-upsert': 'false',
    },
    body: buffer,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(errorText || 'Unable to upload template image.');
  }

  return `${baseUrl}/storage/v1/object/public/${TEMPLATE_BUCKET}/${objectPath}`;
}

async function createTemplate(supabaseUrl, serviceRoleKey, body) {
  const imageUrl = await uploadTemplateImage(supabaseUrl, serviceRoleKey, body);
  const baseUrl = supabaseUrl.replace(/\/$/, '');
  const endpoint = `${baseUrl}/rest/v1/${TEMPLATES_TABLE}?select=id,template_number,title,category_id,image_url,shape,visible,featured,created_at,template_categories(name)`;
  const rows = await fetchJson(endpoint, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(serviceRoleKey),
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      title: getRequiredString(body.title, 'Template title'),
      category_id: body.categoryId || null,
      image_url: imageUrl,
      shape: normalizeTemplateShape(body.shape),
      visible: normalizeBoolean(body.visible, true),
      featured: normalizeBoolean(body.featured, false),
    }),
  }, 'Unable to save magnet template.');

  return normalizeTemplate(rows[0]);
}

async function updateTemplate(supabaseUrl, serviceRoleKey, body) {
  const id = getRequiredString(body.id, 'Template id');
  const patch = {};

  if (typeof body.visible === 'boolean') {
    patch.visible = body.visible;
  }

  if (typeof body.featured === 'boolean') {
    patch.featured = body.featured;
  }

  if (typeof body.shape === 'string') {
    patch.shape = normalizeTemplateShape(body.shape);
  }

  if (Object.keys(patch).length === 0) {
    throw new Error('No template changes were provided.');
  }

  const baseUrl = supabaseUrl.replace(/\/$/, '');
  const endpoint = new URL(`${baseUrl}/rest/v1/${TEMPLATES_TABLE}`);
  endpoint.searchParams.set('id', `eq.${id}`);
  endpoint.searchParams.set('select', 'id,template_number,title,category_id,image_url,shape,visible,featured,created_at,template_categories(name)');

  const rows = await fetchJson(endpoint, {
    method: 'PATCH',
    headers: {
      ...getAuthHeaders(serviceRoleKey),
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(patch),
  }, 'Unable to update magnet template.');

  return normalizeTemplate(rows[0]);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const { url: supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const settingsPin = process.env.SETTINGS_PIN || '2468';

  if (!supabaseUrl || !serviceRoleKey) {
    return sendJson(res, 500, { error: 'Supabase template storage is not configured.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    if (String(body?.pin || '') !== settingsPin) {
      return sendJson(res, 403, { error: 'Incorrect PIN.' });
    }

    if (body?.action === 'list') {
      return sendJson(res, 200, await loadTemplateLibrary(supabaseUrl, serviceRoleKey));
    }

    if (body?.action === 'createCategory') {
      return sendJson(res, 200, { category: await createCategory(supabaseUrl, serviceRoleKey, body) });
    }

    if (body?.action === 'createTemplate') {
      return sendJson(res, 200, { template: await createTemplate(supabaseUrl, serviceRoleKey, body) });
    }

    if (body?.action === 'updateTemplate') {
      return sendJson(res, 200, { template: await updateTemplate(supabaseUrl, serviceRoleKey, body) });
    }

    return sendJson(res, 400, { error: 'Unknown template admin action.' });
  } catch (error) {
    return sendJson(res, 400, {
      error: error.message || 'Unable to update template library.',
    });
  }
}
