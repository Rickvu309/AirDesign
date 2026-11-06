export function deploymentRuntimeHits(file:string,source:string): string[] {
  const normalized=file.replaceAll("\\","/")
  if (/apps\/worker\/src\/(isolation|export\/deliver)\.ts$/.test(normalized) && source.includes('spawn("systemd-run"') && !source.includes('isolationMode() === "container"')) return ["worker-isolation-mode: select the configured container or systemd driver"]
  if (normalized.endsWith("apps/server/src/main.ts") && /mail:\s*inbox[,\n]/.test(source)) return ["production-mail: select the configured mail adapter at startup"]
  if (normalized.endsWith("bench/sync/local-stack.mjs") && source.includes('AIRDESIGN_EXPOSE_INBOX:"1"') && !source.includes('NODE_ENV:"test"')) return ["fixture-environment: set NODE_ENV to test before exposing the fixture inbox"]
  if (normalized.endsWith("apps/site/vite.config.ts") && !source.includes('process.env.AIRDESIGN_STUDIO_ORIGIN ?? "https://studio.airdesign.app"')) return ["production-studio-links: configure the Studio origin with its production default"]
  if (normalized.endsWith("apps/server/src/main.ts") && source.includes("localAdapter")) return ["production-agent: deterministic adapters belong in test or bench wiring"]
  if (normalized.endsWith("packages/agent/src/sdk-adapter.ts") && !source.includes("abortController:controller")) return ["sdk-run-boundary: wire cancellation and contain detached transport rejections"]
  if (normalized.endsWith("packages/agent/src/harness.ts") && !source.includes('process.on("unhandledRejection"')) return ["agent-process-boundary: contain detached adapter rejections"]
  if (normalized.endsWith("apps/server/src/agent/handle.ts") && source.includes('catch(error){if(data.kind!=="stopped"){')) return ["agent-stop-errors: swallow only expected cancellation errors"]
  if (normalized.endsWith("packages/agent/src/harness.ts") && source.includes("input:z.unknown()")) return ["sdk-tool-schema: expose the authoritative tool arguments to the model"]
  return []
}
