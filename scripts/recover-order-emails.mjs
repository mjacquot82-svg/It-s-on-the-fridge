import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const FROM = 'orders@jdsstudio.ca';
export const TO = 'jenniferjacquotphotography@gmail.com';
export const BASE = 'https://gmwksncfxwzhyfczuoji.supabase.co';
export const START = Date.parse('2026-11-04T02:50:00Z');
export const EXPIRY = Date.parse('2026-11-04T03:50:00Z');
export const ORIGINAL_ERROR = 'The appthat.ca domain is not verified. Please, add and verify your domain on https://resend.com/domains';
export const ORDERS = Object.freeze([
  { number: 'IOF-20260718-986634AA', id: 'b5fdaae0-4a55-4ee6-ab4e-0ebccbdf01e7', type: 'ready_made', submitted: '2026-07-18T01:17:26.751Z', quantity: 1, items: 1 },
  { number: 'IOF-20260731-36B925C9', id: '19b0e5a5-39fe-49f4-8116-ff28771f0568', type: 'ready_made', submitted: '2026-07-31T01:13:13.074Z', quantity: 2, items: 2 },
  { number: 'IOF-20261028-EB9BC5E2', id: 'a6b3de91-9bc5-4110-922d-040ad4cb8c8b', type: 'custom_photo', submitted: '2026-10-28T03:03:18.240Z', quantity: 1,
    images: [
      { type: 'original', name: 'original.jpg', size: 858505, hash: '19efc7274d987f4fee42feaa2544d7b51617826ed5bea7dafa81fbc99654e9ad' },
      { type: 'print_ready', name: 'print-ready.jpg', size: 585706, hash: '57d064a66bd214ad45bf4ceeb232005c09ab4f2330534eefd365b0f76bf431e0' },
    ] },
  { number: 'IOF-20261103-F1D51F01', id: '2bea0aed-d4f1-4d86-9b34-28c5dc2aea62', type: 'custom_photo', submitted: '2026-11-03T21:24:08.149Z', quantity: 1,
    hold: 'prior_gmail_outcome_uncertain',
    images: [
      { type: 'original', name: 'original.jpg', size: 772454, hash: '9c1f1c061e40d01bef30f5979f77e8faaa082223108b7c38e42b17ab3495a4bf' },
      { type: 'print_ready', name: 'print-ready.jpg', size: 437176, hash: 'ec32c7b5ec65923ac037f0acb4bf9b58f53b721c0d0d13cef872dd8022dd61e7' },
    ] },
].map(Object.freeze));

const hash = value => createHash('sha256').update(value).digest('hex');
class RecoveryError extends Error {
  constructor(code, id) { super(code); this.result = { status: code, ...(id ? { id } : {}) }; }
}
const fail = (code, id) => { throw new RecoveryError(code, id); };

export function eligibility(row, expected) {
  if (row.id !== expected.id || row.public_order_number !== expected.number || row.order_type !== expected.type
    || new Date(row.submitted_at).toISOString() !== expected.submitted || row.total_quantity !== expected.quantity) fail('order_identity_mismatch');
  if (row.resend_message_id) return 'skip_existing_provider_id';
  if (expected.hold) return `blocked_${expected.hold}`;
  if (row.email_status !== 'email_failed' || row.email_error !== ORIGINAL_ERROR) return 'blocked_status_requires_review';
  return 'eligible';
}

export function buildMessage(row, items, attachments) {
  const lines = ["It's On The Fridge — historical order notification recovery", '',
    'This is a delayed notification for an existing saved order, not a new order.',
    'Please check whether it has already been fulfilled before processing. No new payment or order was created.', '',
    `Original order number: ${row.public_order_number}`,
    `Original submission (UTC): ${new Date(row.submitted_at).toISOString()}`, '',
    `Customer: ${row.customer_name}`, `Email: ${row.customer_email}`, `Phone: ${row.customer_phone}`,
    `Notes: ${row.customer_notes || 'None'}`, `Total quantity: ${row.total_quantity}`, '',
  ];
  if (row.order_type === 'ready_made') {
    lines.push('Saved ready-made items:');
    for (const item of items) {
      lines.push(`${item.template_number} — ${item.template_title} × ${item.quantity}`);
      if (item.template_image_url) lines.push(`Template image: ${item.template_image_url}`);
    }
  } else {
    lines.push(`Magnet shape: ${row.magnet_type}`, 'Attachments: original customer photo and print-ready magnet image.');
  }
  return { from: FROM, to: TO, reply_to: row.customer_email,
    subject: `Historical order recovery — ${row.public_order_number}`,
    text: lines.join('\n'), ...(attachments.length ? { attachments } : {}) };
}

export async function runRecovery({ execute = false, env = process.env, now = Date.now, fetchImpl = fetch, report = () => {} } = {}) {
  if (now() < START || now() >= EXPIRY) fail('execution_window_closed');
  if (env.VERCEL_ENV !== 'production' || env.VERCEL_PROJECT_ID !== 'prj_63HWF3y2oDib1BzFK9GezNmRnKAM') fail('wrong_production_project');
  if ((env.SUPABASE_URL || env.VITE_SUPABASE_URL)?.replace(/\/$/, '') !== BASE
    || env.RESEND_FROM_EMAIL !== FROM || env.JENNIFER_EMAIL !== TO
    || !env.SUPABASE_SERVICE_ROLE_KEY || !env.RESEND_API_KEY) fail('configuration_mismatch');
  const dbHeaders = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };
  async function db(table, params, patch) {
    const url = new URL(`${BASE}/rest/v1/${table}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    let response;
    try {
      response = await fetchImpl(url.href, { method: patch ? 'PATCH' : 'GET', redirect: 'error', signal: AbortSignal.timeout(15000),
        headers: { ...dbHeaders, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        ...(patch ? { body: JSON.stringify(patch) } : {}) });
    } catch { fail(patch ? 'database_write_uncertain_stop' : 'database_read_failed'); }
    if (!response.ok) fail(patch ? 'database_write_failed_stop' : 'database_read_failed');
    let rows;
    try { rows = await response.json(); } catch { fail(patch ? 'database_write_uncertain_stop' : 'database_read_failed'); }
    if (!Array.isArray(rows)) fail('database_response_invalid');
    return rows;
  }
  // Preflight every non-held payload before any claim/send; only allowlisted rows are read.
  const prepared = [];
  for (const expected of ORDERS) {
    const rows = await db('fridge_orders', { id: `eq.${expected.id}`, select: '*' });
    if (rows.length !== 1) fail('order_missing_or_ambiguous');
    const row = rows[0];
    const state = eligibility(row, expected);
    if (state !== 'eligible') { report({ order: expected.number, status: state }); continue; }
    if (!row.customer_name || !row.customer_phone || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.customer_email)) fail('customer_details_missing');
    let items = [];
    const attachments = [];
    if (expected.type === 'ready_made') {
      items = await db('fridge_order_items', { order_id: `eq.${expected.id}`, select: '*', order: 'template_number.asc,id.asc' });
      if (items.length !== expected.items || items.some(i => i.order_id !== expected.id || !i.template_number || !i.template_title
        || !Number.isInteger(i.quantity) || i.quantity < 1 || (i.template_image_url && !i.template_image_url.startsWith('https://')))
        || items.reduce((sum, i) => sum + i.quantity, 0) !== row.total_quantity) fail('saved_items_mismatch');
    } else {
      const images = await db('fridge_order_images', { order_id: `eq.${expected.id}`, select: '*' });
      if (images.length !== 2 || !['round', 'rectangle'].includes(row.magnet_type)) fail('saved_images_mismatch');
      for (const spec of expected.images) {
        const image = images.find(i => i.image_type === spec.type);
        const path = `fridge-orders/${expected.id}/${spec.name}`;
        if (!image || image.order_id !== expected.id || image.bucket !== 'fridge-order-images' || image.object_path !== path
          || image.content_type !== 'image/jpeg' || image.size_bytes !== spec.size) fail('saved_image_metadata_mismatch');
        let response;
        try { response = await fetchImpl(`${BASE}/storage/v1/object/authenticated/fridge-order-images/${path}`, {
          headers: dbHeaders, redirect: 'error', signal: AbortSignal.timeout(15000),
        }); } catch { fail('private_image_read_failed'); }
        if (!response.ok) fail('private_image_read_failed');
        let bytes;
        try { bytes = Buffer.from(await response.arrayBuffer()); } catch { fail('private_image_read_failed'); }
        if (bytes.length !== spec.size || hash(bytes) !== spec.hash) fail('private_image_integrity_mismatch');
        attachments.push({ filename: `${expected.number}-${spec.name}`, content: bytes.toString('base64'), contentType: 'image/jpeg' });
      }
    }
    const body = JSON.stringify(buildMessage(row, items, attachments));
    prepared.push({ row, expected, body, marker: `historical-recovery-v1:claimed:${hash(body)}` });
    report({ order: expected.number, status: 'preflight_ok', attachmentCount: attachments.length });
  }
  if (!execute) return { status: 'read_only_preflight', eligible: prepared.length };
  for (const { row, expected, body, marker } of prepared) {
    if (now() < START || now() >= EXPIRY) fail('execution_window_closed');
    // Atomic compare-and-set: only one runner can claim this exact unchanged failed row.
    const claim = await db('fridge_orders', { id: `eq.${expected.id}`, public_order_number: `eq.${expected.number}`,
      email_status: 'eq.email_failed', resend_message_id: 'is.null', email_error: `eq.${ORIGINAL_ERROR}`,
      updated_at: `eq.${row.updated_at}`, select: 'id,email_status,email_error,resend_message_id',
    }, { email_status: 'email_pending', email_error: marker });
    if (claim.length === 0) { report({ order: expected.number, status: 'skipped_claim_conflict' }); continue; }
    if (claim.length !== 1 || claim[0].id !== expected.id || claim[0].email_error !== marker || claim[0].email_status !== 'email_pending'
      || claim[0].resend_message_id) fail('claim_uncertain_stop');
    let response, data;
    try {
      response = await fetchImpl('https://api.resend.com/emails', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json',
          'Idempotency-Key': `fridge-historical-recovery-v1-${expected.id}` }, body });
      data = await response.json();
    } catch { fail('provider_outcome_uncertain_claim_retained'); }
    if (!response.ok) fail(`provider_rejected_http_${response.status}_claim_retained`);
    if (typeof data.id !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(data.id)) fail('provider_id_missing_claim_retained');
    report({ order: expected.number, status: 'accepted_not_delivered', id: data.id });
    // Never reset a claim after an ambiguous send or status write. Operator reconciliation is required.
    let saved;
    try {
      saved = await db('fridge_orders', { id: `eq.${expected.id}`, public_order_number: `eq.${expected.number}`,
        email_status: 'eq.email_pending', resend_message_id: 'is.null', email_error: `eq.${marker}`,
        select: 'id,resend_message_id,email_status',
      }, { email_status: 'email_sent', resend_message_id: data.id, email_error: null });
    } catch { fail('accepted_database_update_uncertain_stop', data.id); }
    if (saved.length !== 1 || saved[0].id !== expected.id || saved[0].resend_message_id !== data.id || saved[0].email_status !== 'email_sent') {
      fail('accepted_database_update_unconfirmed_stop', data.id);
    }
    report({ order: expected.number, status: 'accepted_id_recorded', id: data.id });
  }
  return { status: 'recovery_run_complete_delivery_requires_provider_confirmation' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 3 || !['--check', '--execute'].includes(process.argv[2])) {
    console.error('Exactly --check or --execute is required.'); process.exitCode = 1;
  } else {
    try { console.log(JSON.stringify(await runRecovery({ execute: process.argv[2] === '--execute', report: result => console.log(JSON.stringify(result)) }))); }
    catch (error) { console.error(JSON.stringify(error instanceof RecoveryError ? error.result : { status: 'unexpected_error_stop' })); process.exitCode = 1; }
  }
}
