import assert from 'node:assert/strict';
import test from 'node:test';
import { CHECK, verifyDelivery } from './verify-email-delivery.mjs';

const env = { VERCEL_ENV: 'production', VERCEL_PROJECT_ID: 'prj_63HWF3y2oDib1BzFK9GezNmRnKAM', RESEND_FROM_EMAIL: CHECK.from, JENNIFER_EMAIL: 'jenniferjacquotphotography@gmail.com', RESEND_API_KEY: 'mock-only' };
const now = CHECK.starts + 1000;
test('fixed no-order request, stable duplicate key, no database call', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => ({ id: 'mock-message-id' }) }; };
  for (let i = 0; i < 2; i++) assert.equal((await verifyDelivery({ env, now, fetchImpl })).status, 'accepted_not_delivery_confirmation');
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(call.url, 'https://api.resend.com/emails');
    assert.equal(call.options.headers['Idempotency-Key'], CHECK.key);
    assert.deepEqual(JSON.parse(call.options.body), { from: CHECK.from, to: CHECK.to, subject: CHECK.subject, text: CHECK.text });
  }
});
test('outside narrow window never contacts any service', async () => {
  for (const time of [CHECK.starts - 1, CHECK.expires, CHECK.expires + 86400000]) {
    assert.equal((await verifyDelivery({ env, now: time, fetchImpl: () => assert.fail('network called') })).sent, false);
  }
});
test('configuration guard fails before network', async () => {
  for (const patch of [{ VERCEL_ENV: 'preview' }, { VERCEL_PROJECT_ID: 'wrong' }, { RESEND_FROM_EMAIL: 'orders@appthat.ca' }, { JENNIFER_EMAIL: 'wrong@example.com' }, { RESEND_API_KEY: '' }]) {
    await assert.rejects(verifyDelivery({ env: { ...env, ...patch }, now, fetchImpl: () => assert.fail('network called') }));
  }
});
test('provider rejection does not print response secrets or retry', async () => {
  let count = 0;
  await assert.rejects(verifyDelivery({ env, now, fetchImpl: async () => { count++; return { ok: false, status: 403, json: async () => ({ message: 'private provider body' }) }; } }), /^Error: provider_rejected_http_403$/);
  assert.equal(count, 1);
});
test('network and malformed-success outcomes remain uncertain', async () => {
  await assert.rejects(verifyDelivery({ env, now, fetchImpl: async () => { throw new Error('private transport details'); } }), /provider_outcome_uncertain_check_logs_before_retry/);
  await assert.rejects(verifyDelivery({ env, now, fetchImpl: async () => ({ ok: true, json: async () => ({}) }) }), /provider_id_missing_check_logs/);
});
