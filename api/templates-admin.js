/* global process, Buffer */

const CATEGORIES_TABLE = 'template_categories';
const TEMPLATES_TABLE = 'magnet_templates';
const TEMPLATE_BUCKET = 'ready-made-templates';
const UNCATEGORIZED_CATEGORY_NAME = 'Uncategorized';

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
    isSystem: Boolean(row.is_system),
  };
}

function normalizeTemplate(row) {
  return {
    id: row.id,
    templateNumber: row.template_number,
    title: row.title,
    categoryId: row.category_id,
    categoryName: row.template_categories?.name || '',
    categoryIsSystem: Boolean(row.template_categories?.is_system),
    imageUrl: row.image_url,
    shape: normalizeTemplateShape(row.shape),
    visible: row.visible,
    featured: row.featured,
    displayOrder: row.display_order,
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
  categoriesUrl.searchParams.set('select', 'id,name,sort_order,visible,is_system');
  categoriesUrl.searchParams.set('order', 'is_system.asc,sort_order.asc,name.asc');

  const templatesUrl = new URL(`${baseUrl}/rest/v1/${TEMPLATES_TABLE}`);
  templatesUrl.searchParams.set('select', 'id,template_number,title,category_id,image_url,shape,visible,featured,display_order,created_at,template_categories(name,is_system)');
  templatesUrl.searchParams.set('order', 'category_id.asc.nullslast,display_order.asc,created_at.asc');

  const [categories, templates] = await Promise.all([
    fetchJson(categoriesUrl, { headers }, 'Unable to load template categories.'),
    fetchJson(templatesUrl, { headers }, 'Unable to load magnet templates.'),
  ]);

  return {
    categories: categories.map(normalizeCategory),
    templates: templates.map(normalizeTemplate),
  };
}

async function ensureCategoryNameAvailable(supabaseUrl, serviceRoleKey, name, excludedCategoryId = '') {
  const baseUrl = supabaseUrl.replace(/\/$/, '');
  const endpoint = new URL(`${baseUrl}/rest/v1/${CATEGORIES_TABLE}`);
  endpoint.searchParams.set('select', 'id,name');

  const rows = await fetchJson(endpoint, {
    headers: getAuthHeaders(serviceRoleKey),
  }, 'Unable to inspect template categories.');
  const normalizedName = name.trim().toLowerCase();
  const duplicate = rows.find(row => (
    row.id !== excludedCategoryId && String(row.name || '').trim().toLowerCase() === normalizedName
  ));

  if (duplicate) {
    throw new Error('A category with that name already exists.');
  }
}

async function createCategory(supabaseUrl, serviceRoleKey, body) {
  const baseUrl = supabaseUrl.replace(/\/$/, '');
  const name = getRequiredString(body.name, 'Category name');

  await ensureCategoryNameAvailable(supabaseUrl, serviceRoleKey, name);

  const maxSortUrl = new URL(`${baseUrl}/rest/v1/${CATEGORIES_TABLE}`);
  maxSortUrl.searchParams.set('select', 'sort_order');
  maxSortUrl.searchParams.set('is_system', 'eq.false');
  maxSortUrl.searchParams.set('order', 'sort_order.desc');
  maxSortUrl.searchParams.set('limit', '1');

  const maxRows = await fetchJson(maxSortUrl, {
    headers: getAuthHeaders(serviceRoleKey),
  }, 'Unable to inspect template categories.');
  const nextSortOrder = (maxRows[0]?.sort_order || 0) + 1;

  const endpoint = `${baseUrl}/rest/v1/${CATEGORIES_TABLE}?select=id,name,sort_order,visible,is_system`;
  const rows = await fetchJson(endpoint, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(serviceRoleKey),
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      name,
      sort_order: nextSortOrder,
      visible: normalizeBoolean(body.visible, true),
      is_system: false,
    }),
  }, 'Unable to create template category.');

  return normalizeCategory(rows[0]);
}

async function updateCategory(supabaseUrl, serviceRoleKey, body) {
  const categoryId = getRequiredString(body.categoryId, 'Category id');
  const name = getRequiredString(body.name, 'Category name');
  const category = await fetchCategory(supabaseUrl, serviceRoleKey, categoryId);

  if (!category) {
    throw new Error('Category was not found.');
  }

  if (category.isSystem) {
    throw new Error('Uncategorized cannot be edited.');
  }

  await ensureCategoryNameAvailable(supabaseUrl, serviceRoleKey, name, categoryId);

  if (category.name.trim() === name) {
    return category;
  }

  const baseUrl = supabaseUrl.replace(/\/$/, '');
  const endpoint = new URL(`${baseUrl}/rest/v1/${CATEGORIES_TABLE}`);
  endpoint.searchParams.set('id', `eq.${categoryId}`);
  endpoint.searchParams.set('is_system', 'eq.false');
  endpoint.searchParams.set('select', 'id,name,sort_order,visible,is_system');

  const rows = await fetchJson(endpoint, {
    method: 'PATCH',
    headers: {
      ...getAuthHeaders(serviceRoleKey),
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      name,
    }),
  }, 'Unable to update template category.');

  return normalizeCategory(rows[0]);
}

async function ensureUncategorizedCategory(supabaseUrl, serviceRoleKey) {
  const baseUrl = supabaseUrl.replace(/\/$/, '');
  const headers = getAuthHeaders(serviceRoleKey);
  const existingUrl = new URL(`${baseUrl}/rest/v1/${CATEGORIES_TABLE}`);
  existingUrl.searchParams.set('select', 'id,name,sort_order,visible,is_system');
  existingUrl.searchParams.set('is_system', 'eq.true');
  existingUrl.searchParams.set('name', `eq.${UNCATEGORIZED_CATEGORY_NAME}`);
  existingUrl.searchParams.set('limit', '1');

  const existingRows = await fetchJson(existingUrl, { headers }, 'Unable to load Uncategorized category.');

  if (existingRows[0]) {
    return normalizeCategory(existingRows[0]);
  }

  const endpoint = `${baseUrl}/rest/v1/${CATEGORIES_TABLE}?select=id,name,sort_order,visible,is_system`;
  const rows = await fetchJson(endpoint, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      name: UNCATEGORIZED_CATEGORY_NAME,
      sort_order: 0,
      visible: false,
      is_system: true,
    }),
  }, 'Unable to create Uncategorized category.');

  return normalizeCategory(rows[0]);
}

async function reorderCategories(supabaseUrl, serviceRoleKey, body) {
  const categoryIds = Array.isArray(body.categoryIds) ? body.categoryIds : [];

  if (categoryIds.length === 0) {
    throw new Error('No category order was provided.');
  }

  const baseUrl = supabaseUrl.replace(/\/$/, '');
  const headers = getAuthHeaders(serviceRoleKey);

  await Promise.all(categoryIds.map((categoryId, index) => {
    const endpoint = new URL(`${baseUrl}/rest/v1/${CATEGORIES_TABLE}`);
    endpoint.searchParams.set('id', `eq.${getRequiredString(categoryId, 'Category id')}`);
    endpoint.searchParams.set('is_system', 'eq.false');

    return fetchJson(endpoint, {
      method: 'PATCH',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sort_order: index + 1,
      }),
    }, 'Unable to reorder template categories.');
  }));

  const library = await loadTemplateLibrary(supabaseUrl, serviceRoleKey);
  return library.categories;
}

function getStorageObjectPath(supabaseUrl, imageUrl) {
  const baseUrl = supabaseUrl.replace(/\/$/, '');
  const publicPrefix = `${baseUrl}/storage/v1/object/public/${TEMPLATE_BUCKET}/`;
  const privatePrefix = `${baseUrl}/storage/v1/object/${TEMPLATE_BUCKET}/`;
  const text = String(imageUrl || '');

  if (text.startsWith(publicPrefix)) {
    return decodeURIComponent(text.slice(publicPrefix.length));
  }

  if (text.startsWith(privatePrefix)) {
    return decodeURIComponent(text.slice(privatePrefix.length));
  }

  return '';
}

async function deleteTemplateImage(supabaseUrl, serviceRoleKey, imageUrl) {
  const objectPath = getStorageObjectPath(supabaseUrl, imageUrl);

  if (!objectPath) {
    return;
  }

  const baseUrl = supabaseUrl.replace(/\/$/, '');
  const deleteUrl = `${baseUrl}/storage/v1/object/${TEMPLATE_BUCKET}/${objectPath}`;
  const response = await fetch(deleteUrl, {
    method: 'DELETE',
    headers: getAuthHeaders(serviceRoleKey),
  });

  if (!response.ok && response.status !== 404) {
    const errorText = await response.text().catch(() => '');
    throw new Error(errorText || 'Unable to delete template image.');
  }
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
  const headers = getAuthHeaders(serviceRoleKey);
  const categoryId = body.categoryId || null;
  const maxOrderUrl = new URL(`${baseUrl}/rest/v1/${TEMPLATES_TABLE}`);
  maxOrderUrl.searchParams.set('select', 'display_order');
  maxOrderUrl.searchParams.set('order', 'display_order.desc');
  maxOrderUrl.searchParams.set('limit', '1');

  if (categoryId) {
    maxOrderUrl.searchParams.set('category_id', `eq.${categoryId}`);
  } else {
    maxOrderUrl.searchParams.set('category_id', 'is.null');
  }

  const maxRows = await fetchJson(maxOrderUrl, {
    headers,
  }, 'Unable to inspect template order.');
  const nextDisplayOrder = (maxRows[0]?.display_order ?? -1) + 1;
  const endpoint = `${baseUrl}/rest/v1/${TEMPLATES_TABLE}?select=id,template_number,title,category_id,image_url,shape,visible,featured,display_order,created_at,template_categories(name,is_system)`;
  const rows = await fetchJson(endpoint, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      title: getRequiredString(body.title, 'Template title'),
      category_id: categoryId,
      image_url: imageUrl,
      shape: normalizeTemplateShape(body.shape),
      visible: normalizeBoolean(body.visible, true),
      featured: normalizeBoolean(body.featured, false),
      display_order: nextDisplayOrder,
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
  endpoint.searchParams.set('select', 'id,template_number,title,category_id,image_url,shape,visible,featured,display_order,created_at,template_categories(name,is_system)');

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

async function reorderTemplates(supabaseUrl, serviceRoleKey, body) {
  const templateIds = Array.isArray(body.templateIds) ? body.templateIds.map(String) : [];
  const uniqueTemplateIds = [...new Set(templateIds)];

  if (uniqueTemplateIds.length === 0 || uniqueTemplateIds.length !== templateIds.length) {
    throw new Error('A valid template order is required.');
  }

  const categoryMode = body.categoryMode === 'uncategorized' ? 'uncategorized' : 'category';
  const categoryId = categoryMode === 'category' ? getRequiredString(body.categoryId, 'Category id') : null;
  const baseUrl = supabaseUrl.replace(/\/$/, '');
  const headers = getAuthHeaders(serviceRoleKey);
  const lookupEndpoint = new URL(`${baseUrl}/rest/v1/${TEMPLATES_TABLE}`);
  lookupEndpoint.searchParams.set('select', 'id,category_id,template_categories(is_system)');
  lookupEndpoint.searchParams.set('id', `in.(${uniqueTemplateIds.join(',')})`);

  const rows = await fetchJson(lookupEndpoint, {
    headers,
  }, 'Unable to load templates for reordering.');

  if (rows.length !== uniqueTemplateIds.length) {
    throw new Error('Template order contains an unknown template.');
  }

  const rowsById = new Map(rows.map(row => [row.id, row]));

  uniqueTemplateIds.forEach(templateId => {
    const row = rowsById.get(templateId);
    const isUncategorized = !row.category_id || Boolean(row.template_categories?.is_system);

    if (categoryMode === 'uncategorized' && !isUncategorized) {
      throw new Error('Template order can only include templates from the selected category.');
    }

    if (categoryMode === 'category' && row.category_id !== categoryId) {
      throw new Error('Template order can only include templates from the selected category.');
    }
  });

  await Promise.all(uniqueTemplateIds.map((templateId, index) => {
    const endpoint = new URL(`${baseUrl}/rest/v1/${TEMPLATES_TABLE}`);
    endpoint.searchParams.set('id', `eq.${templateId}`);

    return fetchJson(endpoint, {
      method: 'PATCH',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        display_order: index,
      }),
    }, 'Unable to save template order.');
  }));

  return loadTemplateLibrary(supabaseUrl, serviceRoleKey);
}

async function loadTemplatesByCategory(supabaseUrl, serviceRoleKey, categoryId) {
  const baseUrl = supabaseUrl.replace(/\/$/, '');
  const endpoint = new URL(`${baseUrl}/rest/v1/${TEMPLATES_TABLE}`);
  endpoint.searchParams.set('select', 'id,image_url');
  endpoint.searchParams.set('category_id', `eq.${categoryId}`);

  return fetchJson(endpoint, {
    headers: getAuthHeaders(serviceRoleKey),
  }, 'Unable to load category templates.');
}

async function fetchCategory(supabaseUrl, serviceRoleKey, categoryId) {
  const baseUrl = supabaseUrl.replace(/\/$/, '');
  const endpoint = new URL(`${baseUrl}/rest/v1/${CATEGORIES_TABLE}`);
  endpoint.searchParams.set('select', 'id,name,sort_order,visible,is_system');
  endpoint.searchParams.set('id', `eq.${categoryId}`);
  endpoint.searchParams.set('limit', '1');

  const rows = await fetchJson(endpoint, {
    headers: getAuthHeaders(serviceRoleKey),
  }, 'Unable to load template category.');

  return rows[0] ? normalizeCategory(rows[0]) : null;
}

async function deleteCategory(supabaseUrl, serviceRoleKey, body) {
  const categoryId = getRequiredString(body.categoryId, 'Category id');
  const templateAction = body.templateAction === 'delete' ? 'delete' : 'move';
  const category = await fetchCategory(supabaseUrl, serviceRoleKey, categoryId);

  if (!category) {
    throw new Error('Category was not found.');
  }

  if (category.isSystem) {
    throw new Error('Uncategorized cannot be deleted.');
  }

  const baseUrl = supabaseUrl.replace(/\/$/, '');
  const headers = getAuthHeaders(serviceRoleKey);

  if (templateAction === 'move') {
    const uncategorized = await ensureUncategorizedCategory(supabaseUrl, serviceRoleKey);
    const templateEndpoint = new URL(`${baseUrl}/rest/v1/${TEMPLATES_TABLE}`);
    templateEndpoint.searchParams.set('category_id', `eq.${categoryId}`);

    await fetchJson(templateEndpoint, {
      method: 'PATCH',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        category_id: uncategorized.id,
      }),
    }, 'Unable to move templates to Uncategorized.');
  } else {
    const templates = await loadTemplatesByCategory(supabaseUrl, serviceRoleKey, categoryId);
    await Promise.all(templates.map(template => (
      deleteTemplateImage(supabaseUrl, serviceRoleKey, template.image_url)
    )));

    const templateEndpoint = new URL(`${baseUrl}/rest/v1/${TEMPLATES_TABLE}`);
    templateEndpoint.searchParams.set('category_id', `eq.${categoryId}`);
    await fetchJson(templateEndpoint, {
      method: 'DELETE',
      headers,
    }, 'Unable to delete category templates.');
  }

  const categoryEndpoint = new URL(`${baseUrl}/rest/v1/${CATEGORIES_TABLE}`);
  categoryEndpoint.searchParams.set('id', `eq.${categoryId}`);
  await fetchJson(categoryEndpoint, {
    method: 'DELETE',
    headers,
  }, 'Unable to delete template category.');

  return loadTemplateLibrary(supabaseUrl, serviceRoleKey);
}

async function deleteTemplate(supabaseUrl, serviceRoleKey, body) {
  const templateId = getRequiredString(body.templateId, 'Template id');
  const baseUrl = supabaseUrl.replace(/\/$/, '');
  const headers = getAuthHeaders(serviceRoleKey);
  const lookupEndpoint = new URL(`${baseUrl}/rest/v1/${TEMPLATES_TABLE}`);
  lookupEndpoint.searchParams.set('select', 'id,image_url');
  lookupEndpoint.searchParams.set('id', `eq.${templateId}`);
  lookupEndpoint.searchParams.set('limit', '1');

  const rows = await fetchJson(lookupEndpoint, {
    headers,
  }, 'Unable to load template.');
  const template = rows[0];

  if (!template) {
    throw new Error('Template was not found.');
  }

  await deleteTemplateImage(supabaseUrl, serviceRoleKey, template.image_url);

  const deleteEndpoint = new URL(`${baseUrl}/rest/v1/${TEMPLATES_TABLE}`);
  deleteEndpoint.searchParams.set('id', `eq.${templateId}`);
  await fetchJson(deleteEndpoint, {
    method: 'DELETE',
    headers,
  }, 'Unable to delete template.');

  return { deletedTemplateId: templateId };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const { url: supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const settingsPin = process.env.SETTINGS_PIN || '08311984';

  if (!supabaseUrl || !serviceRoleKey) {
    return sendJson(res, 500, { error: 'Supabase template storage is not configured.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    if (String(body?.pin || '') !== settingsPin) {
      return sendJson(res, 403, { error: 'Incorrect PIN.' });
    }

    if (body?.action === 'list') {
      await ensureUncategorizedCategory(supabaseUrl, serviceRoleKey);
      return sendJson(res, 200, await loadTemplateLibrary(supabaseUrl, serviceRoleKey));
    }

    if (body?.action === 'createCategory') {
      return sendJson(res, 200, { category: await createCategory(supabaseUrl, serviceRoleKey, body) });
    }

    if (body?.action === 'updateCategory') {
      return sendJson(res, 200, { category: await updateCategory(supabaseUrl, serviceRoleKey, body) });
    }

    if (body?.action === 'createTemplate') {
      return sendJson(res, 200, { template: await createTemplate(supabaseUrl, serviceRoleKey, body) });
    }

    if (body?.action === 'reorderCategories') {
      return sendJson(res, 200, { categories: await reorderCategories(supabaseUrl, serviceRoleKey, body) });
    }

    if (body?.action === 'reorderTemplates') {
      return sendJson(res, 200, await reorderTemplates(supabaseUrl, serviceRoleKey, body));
    }

    if (body?.action === 'updateTemplate') {
      return sendJson(res, 200, { template: await updateTemplate(supabaseUrl, serviceRoleKey, body) });
    }

    if (body?.action === 'deleteCategory') {
      return sendJson(res, 200, await deleteCategory(supabaseUrl, serviceRoleKey, body));
    }

    if (body?.action === 'deleteTemplate') {
      return sendJson(res, 200, await deleteTemplate(supabaseUrl, serviceRoleKey, body));
    }

    return sendJson(res, 400, { error: 'Unknown template admin action.' });
  } catch (error) {
    return sendJson(res, 400, {
      error: error.message || 'Unable to update template library.',
    });
  }
}
