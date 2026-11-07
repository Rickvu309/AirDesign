import { createServer } from "node:http"
import { once } from "node:events"
import { expect, it } from "vitest"
import { waitForDeploy } from "../../scripts/live/wait-for-deploy.ts"

it("waits through errors and stale commits until the deployed SHA matches", async () => {
  let requests = 0
  const sha = "a".repeat(40)
  const server = createServer((_request, response) => {
    requests++
    if (requests === 1) { response.writeHead(503).end(); return }
    if (requests === 2) { response.end("invalid-json"); return }
    response.setHeader("content-type", "application/json")
    response.end(JSON.stringify({ sha: requests === 3 ? "b".repeat(40) : sha }))
  }).listen(0, "127.0.0.1")
  await once(server, "listening")
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("server-address-required")
  try {
    await waitForDeploy({ sha, url: `http://127.0.0.1:${address.port}/version`, timeoutMs: 2000, intervalMs: 1 })
    expect(requests).toBe(4)
    await expect(waitForDeploy({ sha: "c".repeat(40), url: `http://127.0.0.1:${address.port}/version`, timeoutMs: 50, intervalMs: 1 })).rejects.toThrow("deployment-did-not-reach-commit")
    await expect(waitForDeploy({ sha: "main" })).rejects.toThrow("expected-full-commit-sha")
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
})
