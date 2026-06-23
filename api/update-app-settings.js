/* global process */

const SETTINGS_APP = 'itsonthefridge';
const SETTINGS_TABLE = 'app_settings';

const defaultPricingSettings = {
  roundMagnetPrice: 5,
  rectangleMagnetPrice: 7,
  promotionText: '',
  promotionEnabled: false,
};

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function normalizePrice(value, fallback) {
  const price = Number(value);
  return Number.isFinite(price) && price >= 0 ? price : fallback;
}

function normalizePricingSettings(settings = {}) {
  return {
    roundMagnetPrice: normalizePrice(settings.roundMagnetPrice, defaultPricingSettings.roundMagnetPrice),
    rectangleMagnetPrice: normalizePrice(settings.rectangleMagnetPrice, defaultPricingSettings.rectangleMagnetPrice),
    promotionText: String(settings.promotionText || ''),
    promotionEnabled: Boolean(settings.promotionEnabled),
  };
}

function toSettingRows(settings) {
  return [
    {
      app: SETTINGS_APP,
      key: 'round_price',
      value: settings.roundMagnetPrice,
    },
    {
      app: SETTINGS_APP,
      key: 'rectangle_price',
      value: settings.rectangleMagnetPrice,
    },
    {
      app: SETTINGS_APP,
      key: 'promotion_text',
      value: settings.promotionText,
    },
    {
      app: SETTINGS_APP,
      key: 'promotion_enabled',
      value: settings.promotionEnabled,
    },
  ];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const settingsPin = process.env.SETTINGS_PIN || '08311984';

  if (!supabaseUrl || !serviceRoleKey) {
    return sendJson(res, 500, { error: 'Supabase settings storage is not configured.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    if (String(body?.pin || '') !== settingsPin) {
      return sendJson(res, 403, { error: 'Incorrect PIN.' });
    }

    const settings = normalizePricingSettings(body?.settings);
    const endpoint = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/${SETTINGS_TABLE}?on_conflict=app,key`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(toSettingRows(settings)),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      return sendJson(res, response.status, {
        error: errorText || 'Unable to save settings to Supabase.',
      });
    }

    return sendJson(res, 200, { settings });
  } catch (error) {
    return sendJson(res, 400, {
      error: error.message || 'Unable to save pricing settings.',
    });
  }
}
