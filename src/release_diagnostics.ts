import { z } from "zod";
import { InfraiClient } from "./infrai_client.ts";

// The domain call is intentionally named after the capability: infrai.errors.capture.

export const releaseRequest = z.object({
  project: z.string().min(1),
  version: z.string().min(1),
  changedFiles: z.array(z.string()).min(1),
  smokeTestPassed: z.boolean(),
});
export type ReleaseRequest = z.infer<typeof releaseRequest>;

export function shouldRelease(input: ReleaseRequest): boolean {
  return input.smokeTestPassed && input.changedFiles.length <= 40;
}

export async function recordRelease(input: unknown, client: InfraiClient): Promise<{ released: boolean; jobId?: string }> {
  const release = releaseRequest.parse(input);
  const released = shouldRelease(release);
  const exception = {
    name: released ? "release-approved" : "release-held",
    message: `${release.project}@${release.version}`,
    stack: JSON.stringify({ changedFiles: release.changedFiles, smokeTestPassed: release.smokeTestPassed }),
  };
  await client.request("POST", "/v1/errors/capture", { exception });
  if (!released) return { released };
  const schedule = await client.request<{ job_id: string }>("POST", "/v1/cron/create", {
    cron_expr: "0 * * * *",
    task: "https://example.invalid/health/release",
  });
  return { released, jobId: schedule.job_id };
}

async function main(): Promise<void> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("Set INFRAI_API_KEY before running the demo.");
  const input = {
    project: process.env.CONTENT_PROJECT ?? "creator-studio",
    version: process.env.CONTENT_VERSION ?? "2026.10.23",
    changedFiles: ["src/editor.ts", "src/publish.ts"],
    smokeTestPassed: true,
  };
  const result = await recordRelease(input, new InfraiClient(key));
  console.log(JSON.stringify({ workflow: "content-release", ...result }));
}

if (import.meta.url === `file://${process.argv[1]}`) void main();
