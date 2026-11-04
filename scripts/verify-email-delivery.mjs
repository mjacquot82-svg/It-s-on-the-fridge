import { pathToFileURL } from 'node:url';

// One approved operational check. Never imported by an HTTP route or normal build.
export const CHECK = Object.freeze({
  from: 'orders@jdsstudio.ca',
  to: 'mjacquot82@gmail.com',
  subject: 'Fridge email delivery verification — no order',
  text: 'This is a technical email delivery check for It\'s On The Fridge. No order has been created. No payment or action is required.',
  key: 'fridge-delivery-verification-20261104-0235-v1',
  starts: Date.parse('2026-11-04T02:35:00Z'),
  expires: Date.parse('2026-11-04T03:15:00Z'),
});

export async function verifyDelivery({ env = process.env, now = Date.now(), fetchImpl = fetch } = {}) {
  // The entire execution window is shorter than the provider's deduplication window.
  if (now < CHECK.starts || now >= CHECK.expires) return { status: 'expired_or_not_started', sent: false };
  if (env.VERCEL_ENV !== 'production') throw new Error('production_environment_required');
  if (env.VERCEL_PROJECT_ID !== 'prj_63HWF3y2oDib1BzFK9GezNmRnKAM') throw new Error('production_project_required');
  if (env.RESEND_FROM_EMAIL !== CHECK.from || env.JENNIFER_EMAIL !== 'jenniferjacquotphotography@gmail.com') {
    throw new Error('production_addresses_mismatch');
  }
  if (!env.RESEND_API_KEY) throw new Error('provider_configuration_missing');
  let response;
  try {
    response = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': CHECK.key },
      body: JSON.stringify({ from: CHECK.from, to: CHECK.to, subject: CHECK.subject, text: CHECK.text }),
    });
  } catch {
    throw new Error('provider_outcome_uncertain_check_logs_before_retry');
  }
  let data;
  try { data = await response.json(); } catch { throw new Error('provider_response_uncertain_check_logs'); }
  if (!response.ok) throw new Error(`provider_rejected_http_${response.status}`);
  if (typeof data.id !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(data.id)) throw new Error('provider_id_missing_check_logs');
  return { status: 'accepted_not_delivery_confirmation', id: data.id };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 3 || process.argv[2] !== '--execute') {
    console.error('Explicit --execute is required; no message sent.');
    process.exitCode = 1;
  } else {
    try { console.log(JSON.stringify(await verifyDelivery())); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
