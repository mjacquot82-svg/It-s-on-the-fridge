export const emptyCustomerTemplateLibrary = {
  categories: [],
  templates: [],
};

function getSupabaseConfig() {
  return {
    url: import.meta.env.VITE_SUPABASE_URL,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  };
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
    shape: row.shape === 'round' ? 'round' : 'rectangle',
    visible: row.visible,
    featured: row.featured,
    displayOrder: row.display_order,
    createdAt: row.created_at,
  };
}

async function fetchSupabaseRows(endpoint, anonKey, fallbackError) {
  const response = await fetch(endpoint, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(fallbackError);
  }

  return response.json();
}

export async function fetchCustomerTemplateLibrary() {
  const { url, anonKey } = getSupabaseConfig();

  if (!url || !anonKey) {
    return emptyCustomerTemplateLibrary;
  }

  const baseUrl = url.replace(/\/$/, '');
  const categoriesUrl = new URL(`${baseUrl}/rest/v1/template_categories`);
  categoriesUrl.searchParams.set('select', 'id,name,sort_order,visible,is_system');
  categoriesUrl.searchParams.set('visible', 'eq.true');
  categoriesUrl.searchParams.set('order', 'sort_order.asc,name.asc');

  const templatesUrl = new URL(`${baseUrl}/rest/v1/magnet_templates`);
  templatesUrl.searchParams.set('select', 'id,template_number,title,category_id,image_url,shape,visible,featured,display_order,created_at,template_categories(name,is_system)');
  templatesUrl.searchParams.set('visible', 'eq.true');
  templatesUrl.searchParams.set('order', 'category_id.asc.nullslast,display_order.asc,created_at.asc');

  const [categories, templates] = await Promise.all([
    fetchSupabaseRows(categoriesUrl, anonKey, 'Unable to load template categories.'),
    fetchSupabaseRows(templatesUrl, anonKey, 'Unable to load ready-made designs.'),
  ]);

  return {
    categories: categories.map(normalizeCategory).filter(category => category.visible && !category.isSystem),
    templates: templates.map(normalizeTemplate).filter(template => template.visible),
  };
}
