const SETTINGS_APP = 'itsonthefridge';
const SETTINGS_TABLE = 'app_settings';

export const defaultPricingSettings = {
  roundMagnetPrice: 5,
  rectangleMagnetPrice: 7,
  promotionText: '',
  promotionEnabled: false,
};

const settingKeys = {
  roundMagnetPrice: 'round_price',
  rectangleMagnetPrice: 'rectangle_price',
  promotionText: 'promotion_text',
  promotionEnabled: 'promotion_enabled',
};

function normalizePrice(value, fallback) {
  const price = Number(value);
  return Number.isFinite(price) && price >= 0 ? price : fallback;
}

export function normalizePricingSettings(settings = {}) {
  return {
    roundMagnetPrice: normalizePrice(settings.roundMagnetPrice, defaultPricingSettings.roundMagnetPrice),
    rectangleMagnetPrice: normalizePrice(settings.rectangleMagnetPrice, defaultPricingSettings.rectangleMagnetPrice),
    promotionText: String(settings.promotionText || ''),
    promotionEnabled: Boolean(settings.promotionEnabled),
  };
}

function getSupabaseConfig() {
  return {
    url: import.meta.env.VITE_SUPABASE_URL,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  };
}

function parseSettingRows(rows) {
  const settings = { ...defaultPricingSettings };

  for (const row of rows || []) {
    if (row.key === settingKeys.roundMagnetPrice) {
      settings.roundMagnetPrice = row.value;
    }
    if (row.key === settingKeys.rectangleMagnetPrice) {
      settings.rectangleMagnetPrice = row.value;
    }
    if (row.key === settingKeys.promotionText) {
      settings.promotionText = row.value;
    }
    if (row.key === settingKeys.promotionEnabled) {
      settings.promotionEnabled = row.value;
    }
  }

  return normalizePricingSettings(settings);
}

export async function fetchPricingSettings() {
  const { url, anonKey } = getSupabaseConfig();

  if (!url || !anonKey) {
    console.warn('Supabase settings are not configured; using default pricing settings.');
    return defaultPricingSettings;
  }

  const endpoint = new URL(`${url.replace(/\/$/, '')}/rest/v1/${SETTINGS_TABLE}`);
  endpoint.searchParams.set('app', `eq.${SETTINGS_APP}`);
  endpoint.searchParams.set('select', 'key,value');

  const response = await fetch(endpoint, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  });

  if (!response.ok) {
    throw new Error('Unable to load pricing settings from Supabase.');
  }

  return parseSettingRows(await response.json());
}

export async function savePricingSettings(settings, pin) {
  const response = await fetch('/api/update-app-settings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      pin,
      settings: normalizePricingSettings(settings),
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Unable to save pricing settings.');
  }

  return normalizePricingSettings(data.settings);
}
