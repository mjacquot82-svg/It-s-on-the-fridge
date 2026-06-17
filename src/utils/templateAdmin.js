export const emptyTemplateLibrary = {
  categories: [],
  templates: [],
};

async function postTemplateAdmin(payload) {
  const response = await fetch('/api/templates-admin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Unable to update template library.');
  }

  return data;
}

export function loadTemplateLibrary(pin) {
  return postTemplateAdmin({
    action: 'list',
    pin,
  });
}

export function createTemplateCategory(pin, category) {
  return postTemplateAdmin({
    action: 'createCategory',
    pin,
    ...category,
  });
}

export function createMagnetTemplate(pin, template) {
  return postTemplateAdmin({
    action: 'createTemplate',
    pin,
    ...template,
  });
}

export function reorderTemplateCategories(pin, categoryIds) {
  return postTemplateAdmin({
    action: 'reorderCategories',
    pin,
    categoryIds,
  });
}

export function deleteTemplateCategory(pin, categoryId, templateAction) {
  return postTemplateAdmin({
    action: 'deleteCategory',
    pin,
    categoryId,
    templateAction,
  });
}

export function updateMagnetTemplate(pin, template) {
  return postTemplateAdmin({
    action: 'updateTemplate',
    pin,
    ...template,
  });
}

export function deleteMagnetTemplate(pin, templateId) {
  return postTemplateAdmin({
    action: 'deleteTemplate',
    pin,
    templateId,
  });
}
