import { setTimeout } from "node:timers/promises"
import { pathToFileURL } from "node:url"

export async function waitForDeploy({ sha, url = "https://studio.airdesign.app/version", timeoutMs = 1_200_000, intervalMs = 10_000 }: { sha: string; url?: string; timeoutMs?: number; intervalMs?: number }): Promise<void> {
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error("expected-full-commit-sha")
  const signal = AbortSignal.timeout(timeoutMs)
  try {
    while (!signal.aborted) {
      try {
        const response = await fetch(url, { cache: "no-store", signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]) })
        const value: unknown = response.ok ? await response.json() : undefined
        if (typeof value === "object" && value !== null && "sha" in value && value.sha === sha) return
      } catch {
        signal.throwIfAborted()
      }
      await setTimeout(intervalMs, undefined, { signal })
    }
  } catch {
    throw new Error(`deployment-did-not-reach-commit: ${sha}`)
  }
  throw new Error(`deployment-did-not-reach-commit: ${sha}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await waitForDeploy({ sha: process.argv[2] ?? "" })
}
