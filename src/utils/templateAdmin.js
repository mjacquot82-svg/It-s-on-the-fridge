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

export function updateMagnetTemplate(pin, template) {
  return postTemplateAdmin({
    action: 'updateTemplate',
    pin,
    ...template,
  });
}

export function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Unable to read template image.'));
    reader.readAsDataURL(file);
  });
}
