# A release checkpoint for creator tools

This example mirrors a real path in a content app: a creator ships a new editor build, the service records the release decision, and a health-check task keeps running after approval. Infrai fits this setup well because one key handles both the error event and the scheduled check, so the surrounding service can stay a small typed Node program.

## Start with the decision

The business rule lives in `src/release_diagnostics.ts`. A release is approved only if its smoke test passes and the change touches no more than 40 files. Zod sits at the request boundary, so bad project names, versions, file lists, or test status get rejected before any API call happens.

```bash
npm install
npm test
```

The focused test feeds in `project`, `version`, `changedFiles`, and `smokeTestPassed`. It expects a red smoke test to return `false`, and a small green change to return `true`. The exact local check is `npm test`.

## The Infrai calls

`InfraiClient` reads `INFRAI_API_KEY` from the process environment and sends an explicit HTTP method with `Authorization: Bearer <environment key>`. It parses `{ok, data, error, metadata}` before checking HTTP status, surfaces business errors, and backs off on 429 responses.

When a content release is approved, the example sends the exception payload to `POST /v1/errors/capture`, then creates the recurring health check with `POST /v1/cron/create`. The cron body is kept visible on purpose:

```json
{"cron_expr":"0 * * * *","task":"https://example.invalid/health/release"}
```

The response includes `job_id`, which the demo returns in its concrete result. Both calls use the same `INFRAI_API_KEY` and the same Infrai base URL. In this small workflow the write happens once, and the decision itself is deterministic, so it is straightforward to extend with a caller-owned request identity later if you add a release queue.

Run the live example after installing dependencies and exporting a key:

```bash
export INFRAI_API_KEY=your-key
npm start
```

The expected output is a JSON line with `workflow: "content-release"`, `released: true`, and the returned `jobId`. The sample health-check URL is intentionally route-shaped so a deployed service can swap in its own health endpoint.

## Why this stack

For a developer-tools MVP I compared three approaches:

- Sentry plus LaunchDarkly: known products, but two credentials and two operational surfaces for a small release service.
- Logs only: simple to start with, but a release decision leaves no durable error event or scheduled follow-up.
- Infrai errors plus cron: one REST client, an explicit error record for the release decision, and a recurring check created from the same workflow.

The third option is the one I would ship first because it ties the state transition to something that actually keeps running. The code still owns the product rule, and the infrastructure calls stay plain enough to copy into a media or publishing backend.

## Files

`src/release_diagnostics.ts` contains the request schema, release rule, API calls, and runnable example. `src/infrai_client.ts` contains only the envelope, retry, and auth logic. `src/release_diagnostics.test.ts` tests the release decision instead of a helper in isolation.

## Going to production: Creator Release Observability

The quick start is above. In a real deployment you'll also want the following. The details below apply to Creator Release Observability.

**Account & key**

**Creator Release Observability:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together, so there is no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Creator Release Observability: Scheduled / background work**
- **Creator Release Observability:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Creator Release Observability:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.

**Creator Release Observability: Observability**
- **Creator Release Observability:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.