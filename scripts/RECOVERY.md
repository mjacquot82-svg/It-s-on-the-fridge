# One-time historical notification recovery

This script is a private operational tool, not an HTTP endpoint. It never inserts
orders/items/images, charges customers, or changes the public submission handler.
Normal builds do not run it. Do not execute without publication/send approval.

## Scope

Fixed sender: orders@jdsstudio.ca. Fixed recipient:
jenniferjacquotphotography@gmail.com. The source pins four existing order IDs,
original submission times, order types, quantities, and photo sizes/hashes.

- IOF-20260718-986634AA: ready-made, one saved item.
- IOF-20260731-36B925C9: ready-made, two saved items.
- IOF-20261028-EB9BC5E2: custom photo, original and print-ready attachments.
- IOF-20261103-F1D51F01: BLOCKED because a prior Gmail send has an uncertain
  outcome. No CLI flag or environment variable can release this hold. New
  reconciliation evidence, source review, and tests are required first.

All messages retain the original number and timestamp and explicitly say they
are delayed historical notifications, not new orders. They ask Jen to check
whether the order has already been fulfilled before processing.

## Execution

Only Vercel production project prj_63HWF3y2oDib1BzFK9GezNmRnKAM and Supabase
project gmwksncfxwzhyfczuoji are allowed. Existing environment values are used
inside Vercel; never pull/export them to a workstation or logs.

The fixed execution window is 2026-11-04 02:50–03:50 UTC. If approval arrives
outside that window, stop and review/update the window and tests before use.
Never renew a window to retry an uncertain send, and never change an idempotency
key to force a retry. The provider deduplication window is only 24 hours.

After explicit publication approval, recheck remote main and publish only the
reviewed commit without force. For a private Vercel build execution, record the
current build override first (currently off, empty), temporarily set:

    node scripts/recover-order-emails.mjs --execute && npm run build

Restore the exact original override promptly after the deployment captures its
configuration, including on failure. Reload settings to verify restoration.
The corresponding `--check` command performs read-only payload preflight with
no claims or sends. Do not run the separate verification-email script again.

## Duplicate and uncertainty handling

Any record with a provider ID is skipped. Only the original domain-error rows
are eligible. A conditional PATCH atomically changes the unchanged failed row
to email_pending with a payload-hash claim marker before sending. Concurrent
runners cannot claim it twice. An accepted provider ID is recorded only on
that same claimed existing row. No fulfillment status is inferred or changed.

Timeouts, rejection, malformed responses, and status-write failures stop the
run and retain the claim. Never reset it automatically. A subsequent run skips
claimed rows. The operator must inspect Resend and reconcile before any retry;
if acceptance was logged but the database update failed, reconcile the saved
message ID rather than resend. Record acceptance and delivery separately.

After execution verify each provider Delivered event in authenticated Resend,
the matching existing database IDs/statuses, unchanged order count, production
deployment status, and restored build settings. Logs contain only order numbers,
status codes, attachment counts and provider message IDs, never customer data,
attachment bytes, or credentials.

## Tests

    node --test scripts/recover-order-emails.test.mjs
    npx eslint scripts/recover-order-emails.mjs scripts/recover-order-emails.test.mjs

The optional FRIDGE_RECOVERY_FIXTURES environment variable points to the local
recovered photo directory to run the actual attachment hash test. These private
files must never be committed. All network calls in the tests are mocked.

References:
- https://supabase.com/docs/guides/storage/serving/downloads
- https://docs.postgrest.org/en/stable/references/api/tables_views.html
- https://resend.com/docs/dashboard/emails/idempotency-keys
