import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { BASE, FROM, TO, START, EXPIRY, ORDERS, ORIGINAL_ERROR, eligibility, runRecovery } from './recover-order-emails.mjs';

const env = { VERCEL_ENV: 'production', VERCEL_PROJECT_ID: 'prj_63HWF3y2oDib1BzFK9GezNmRnKAM',
  SUPABASE_URL: BASE, SUPABASE_SERVICE_ROLE_KEY: 'mock-db', RESEND_API_KEY: 'mock-provider', RESEND_FROM_EMAIL: FROM, JENNIFER_EMAIL: TO };
const now = () => START + 1000;
const response = data => ({ ok: true, json: async () => structuredClone(data) });
function fixture({ photos = false, sendMode = 'ok', updateMode = 'ok' } = {}) {
  const rows = ORDERS.map(spec => ({ id: spec.id, public_order_number: spec.number, order_type: spec.type,
    submitted_at: spec.submitted, total_quantity: spec.quantity, updated_at: spec.submitted,
    email_status: 'email_failed', email_error: ORIGINAL_ERROR, resend_message_id: null,
    customer_name: 'Example Customer', customer_email: 'customer@example.com', customer_phone: '5555555555',
    customer_notes: null, magnet_type: 'round' }));
  if (!photos) { rows[2].resend_message_id = 'previously-sent-october'; rows[3].resend_message_id = 'previously-sent-november'; }
  const calls = [], reports = [], sends = [];
  const fetchImpl = async (address, options = {}) => {
    const url = new URL(address); calls.push({ address, options });
    if (url.origin === BASE && url.pathname.startsWith('/rest/v1/')) {
      assert.ok(['GET', 'PATCH'].includes(options.method));
      const table = url.pathname.split('/').pop();
      const id = (url.searchParams.get('id') || url.searchParams.get('order_id')).slice(3);
      const index = ORDERS.findIndex(s => s.id === id); assert.ok(index >= 0, 'only allowlisted rows');
      const row = rows[index], spec = ORDERS[index];
      if (options.method === 'GET') {
        if (table === 'fridge_orders') return response([row]);
        if (table === 'fridge_order_items') return response(Array.from({ length: spec.items }, (_, n) => ({ id: String(n), order_id: id,
          template_number: `T${n}`, template_title: `Saved template ${n}`, quantity: 1, template_image_url: 'https://example.com/template.jpg' })));
        if (table === 'fridge_order_images') return response(spec.images.map(s => ({ order_id: id, image_type: s.type,
          bucket: 'fridge-order-images', object_path: `fridge-orders/${id}/${s.name}`, content_type: 'image/jpeg', size_bytes: s.size })));
        assert.fail('unexpected table');
      }
      assert.equal(table, 'fridge_orders');
      assert.equal(url.searchParams.get('public_order_number'), `eq.${spec.number}`);
      const patch = JSON.parse(options.body);
      assert.deepEqual(Object.keys(patch).sort(), patch.resend_message_id ? ['email_error', 'email_status', 'resend_message_id'] : ['email_error', 'email_status']);
      if (url.searchParams.get('email_status') !== `eq.${row.email_status}` || row.resend_message_id
        || url.searchParams.get('email_error') !== `eq.${row.email_error}`) return response([]);
      if (patch.resend_message_id && updateMode === 'timeout') throw new Error('private db detail');
      if (patch.resend_message_id && updateMode === 'empty') return response([]);
      Object.assign(row, patch); return response([row]);
    }
    if (url.pathname.startsWith('/storage/v1/object/authenticated/')) {
      assert.equal(url.origin, BASE);
      assert.equal(options.redirect, 'error');
      const name = url.pathname.split('/').pop();
      const spec = ORDERS.find(s => url.pathname.includes(`/${s.id}/`));
      assert.ok(spec, 'storage path must belong to an allowlisted order');
      const bytes = readFileSync(join(process.env.FRIDGE_RECOVERY_FIXTURES, `${spec.number}-${name}`));
      return { ok: true, arrayBuffer: async () => bytes };
    }
    assert.equal(address, 'https://api.resend.com/emails');
    const message = JSON.parse(options.body); sends.push({ message, key: options.headers['Idempotency-Key'] });
    assert.equal(message.from, FROM); assert.equal(message.to, TO);
    assert.match(message.subject, /^Historical order recovery/);
    assert.match(message.text, /not a new order/);
    if (sendMode === 'timeout') throw new Error('secret transport info');
    if (sendMode === 'reject') return { ok: false, status: 403, json: async () => ({ message: 'private provider detail' }) };
    if (sendMode === 'bad-id') return response({});
    return response({ id: `provider-${sends.length}` });
  };
  return { rows, calls, reports, sends, options: { env, now, fetchImpl, wait: async ms => assert.equal(ms, 1100), report: value => reports.push(value) } };
}

test('read-only preflight sends nothing and skips existing provider IDs', async () => {
  const f = fixture(); await runRecovery(f.options);
  assert.equal(f.sends.length, 0); assert.ok(f.calls.every(c => c.options.method === 'GET'));
  assert.ok(f.reports.some(r => r.order === ORDERS[3].number && r.status === 'skip_existing_provider_id'));
});
test('ready-made recovery preserves IDs/dates/items; changes only existing email state', async () => {
  const f = fixture(); await runRecovery({ ...f.options, execute: true });
  assert.equal(f.sends.length, 2);
  f.sends.forEach((s, i) => { assert.ok(s.message.text.includes(ORDERS[i].number)); assert.ok(s.message.text.includes(ORDERS[i].submitted));
    assert.ok(s.message.text.includes('Saved template 0')); assert.equal(s.key, `fridge-historical-recovery-v1-${ORDERS[i].id}`); });
  assert.equal(f.rows[0].resend_message_id, 'provider-1'); assert.equal(f.rows[1].resend_message_id, 'provider-2');
  await runRecovery({ ...f.options, execute: true }); assert.equal(f.sends.length, 2, 'accepted orders skipped on rerun');
  assert.equal(f.rows[3].email_status, 'email_failed');
});
test('parallel runners cannot both claim the same order', async () => {
  const f = fixture(); await Promise.all([runRecovery({ ...f.options, execute: true }), runRecovery({ ...f.options, execute: true })]);
  assert.equal(f.sends.length, 2); assert.equal(new Set(f.sends.map(s => s.key)).size, 2);
});
for (const sendMode of ['timeout', 'reject', 'bad-id']) {
  test(`${sendMode} retains claim and blocks fresh resend`, async () => {
    const f = fixture({ sendMode }); await assert.rejects(runRecovery({ ...f.options, execute: true }));
    assert.equal(f.sends.length, 1); assert.equal(f.rows[0].email_status, 'email_pending');
    assert.equal(eligibility(f.rows[0], ORDERS[0]), 'blocked_status_requires_review');
    assert.equal(f.rows[1].email_status, 'email_failed', 'stop before next order');
  });
}
for (const updateMode of ['timeout', 'empty']) {
  test(`accepted send with ${updateMode} database outcome remains blocked`, async () => {
    const f = fixture({ updateMode }); await assert.rejects(runRecovery({ ...f.options, execute: true }), /accepted_database_update/);
    assert.equal(f.sends.length, 1); assert.equal(f.rows[0].email_status, 'email_pending');
    assert.ok(f.reports.some(r => r.status === 'accepted_not_delivered' && r.id === 'provider-1'));
  });
}
test('expiry, project and address guards fail before network', async () => {
  for (const patch of [{ now: () => EXPIRY }, { now: () => START - 1 }, { env: { ...env, VERCEL_ENV: 'preview' } },
    { env: { ...env, JENNIFER_EMAIL: 'wrong@example.com' } }, { env: { ...env, SUPABASE_URL: 'https://other.example' } }]) {
    await assert.rejects(runRecovery({ env, now, ...patch, execute: true, fetchImpl: () => assert.fail('network called') }));
  }
});
test('identity mismatch and previously changed failure status cannot be replayed', () => {
  const f = fixture(); assert.throws(() => eligibility({ ...f.rows[0], id: 'wrong' }, ORDERS[0]), /identity/);
  assert.equal(eligibility({ ...f.rows[0], email_error: 'some other failure' }, ORDERS[0]), 'blocked_status_requires_review');
});
test('claim request timeout stops before any provider request', async () => {
  const f = fixture(); const baseFetch = f.options.fetchImpl;
  await assert.rejects(runRecovery({ ...f.options, execute: true, fetchImpl: (url, opts) => {
    if (opts?.method === 'PATCH') throw new Error('connection lost');
    return baseFetch(url, opts);
  } }), /database_write_uncertain_stop/);
  assert.equal(f.sends.length, 0);
});
test('bad image metadata stops all sends during preflight', async () => {
  const f = fixture({ photos: true }); const baseFetch = f.options.fetchImpl;
  await assert.rejects(runRecovery({ ...f.options, execute: true, fetchImpl: async (url, opts) => {
    if (url.includes('/fridge_order_images?')) return response([]);
    return baseFetch(url, opts);
  } }), /saved_images_mismatch/);
  assert.equal(f.sends.length, 0); assert.ok(f.calls.every(c => c.options.method !== 'PATCH'));
});
test('both photo orders match pinned hashes and each receive exactly two attachments', { skip: !process.env.FRIDGE_RECOVERY_FIXTURES }, async () => {
  const f = fixture({ photos: true }); await runRecovery({ ...f.options, execute: true });
  assert.equal(f.sends.length, 4);
  for (const index of [2, 3]) {
    const mail = f.sends[index].message;
    assert.equal(mail.attachments.length, 2);
    for (let i = 0; i < 2; i++) assert.equal(Buffer.from(mail.attachments[i].content, 'base64').length, ORDERS[index].images[i].size);
    assert.equal(f.rows[index].email_status, 'email_sent');
    assert.ok(mail.text.includes(ORDERS[index].submitted));
  }
  await runRecovery({ ...f.options, execute: true });
  assert.equal(f.sends.length, 4, 'rerunning all four must not resend');
});
