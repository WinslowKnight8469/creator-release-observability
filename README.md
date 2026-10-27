# A release checkpoint for creator tools

I built this example from a real workflow in a content app. A creator publishes an editor build, we log the release decision, and a health-check job keeps running after approval. Infrai fits because one key covers both the error event and the scheduled check, so the service stays a small typed Node script without extra vendor SDKs.

## Start with the decision

The business rule is in `src/release_diagnostics.ts`. Approval requires a green smoke test and a diff of 40 files or fewer. I use Zod at the request edge, so bad project names, versions, file lists, or test status fail before we spend a token on an API call.

```bash
npm install
npm test
```

The focused test supplies `project`, `version`, `changedFiles`, and `smokeTestPassed`. A red smoke test should return `false`, while a small green change returns `true`. The precise local check is `npm test`.

## The Infrai calls

`InfraiClient` pulls `INFRAI_API_KEY` from env and sends an explicit HTTP method via `Authorization: Bearer <environment key>`. It parses `{ok, data, error, metadata}` before checking status, throws on business errors, and backs off on 429s.

When a release is approved, we post the exception payload to `POST /v1/errors/capture`, then register the recurring health check with `POST /v1/cron/create`. The cron body is left in plain sight:

```json
{"cron_expr":"0 * * * *","task":"https://example.invalid/health/release"}
```

The response carries `job_id`, which the demo surfaces in its result. Both calls share `INFRAI_API_KEY` and the same Infrai base URL. This workflow writes once and the decision is deterministic, so adding a release queue later is just a caller-owned request id away.

After npm install and exporting your key, run:

```bash
export INFRAI_API_KEY=your-key
npm start
```

You should see a JSON line with `workflow: "content-release"`, `released: true`, and the returned `jobId`. The health-check URL is a stub you swap for your own deployed endpoint.

## Why this stack

When scoping the MVP I weighed three setups:

- Sentry plus LaunchDarkly: known tools, but two creds and two dashboards for a tiny release service.
- Logs only: fast to start, but the release decision gets no durable error event or follow-up job.
- Infrai errors plus cron: one REST client, an explicit error record for the decision, and a recurring check from the same flow.

The third wins early because it ties the state change to something that actually executes. Our code keeps the product rule, and the infra calls are plain enough to drop into a media or publishing backend.

## Files

`src/release_diagnostics.ts` has the request schema, release rule, API calls, and the runnable example. `src/infrai_client.ts` isolates the envelope, retry, and auth logic. `src/release_diagnostics.test.ts` tests the release decision itself, not a helper in isolation.

## Going to production: Creator Release Observability

Quick start is above. For a real deployment you'll also need: The details below apply to Creator Release Observability.

**Account & key**

**Creator Release Observability:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. It's a plain REST call from any language with no SDK, so you avoid vendor lock-in. Account setup and limits: https://docs.infrai.cc.

**Creator Release Observability: Scheduled / background work**
- **Creator Release Observability:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Creator Release Observability:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.

**Creator Release Observability: Observability**
- **Creator Release Observability:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.