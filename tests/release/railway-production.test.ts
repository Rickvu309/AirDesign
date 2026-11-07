import { expect, it } from "vitest"
import { deployProduction } from "../../scripts/release/railway-production.ts"

const sha = "a".repeat(40)
const old = "b".repeat(40)
type Railway = Parameters<typeof deployProduction>[1]
type Service = Parameters<Railway["deploy"]>[0]

function simulatedRailway(first: Service, failure = false, timeout = false) {
  const deployed: { service: Service; sha: string }[] = []
  const receipts: unknown[] = []
  let elapsed = 0
  let studio = false
  const railway: Railway = {
    currentMain: async () => sha,
    deploy: async (service, commit) => { deployed.push({ service, sha: commit }) },
    deployments: async service => deployed.some(value => value.service === service)
      ? [{ id: `${service}-new`, meta: { commitHash: sha }, status: failure && service === "web" ? "FAILED" : !timeout && (first === service || elapsed > 0) ? "SUCCESS" : "BUILDING" }]
      : [{ id: `${service}-old`, meta: { commitHash: sha }, status: "SUCCESS" }],
    studio: async commit => { expect(commit).toBe(sha); expect(elapsed).toBeGreaterThan(0); studio = true },
    pause: async () => { elapsed += 10 },
    now: () => elapsed,
    receipt: async value => { receipts.push(value) },
  }
  return { railway, deployed, receipts, reachedStudio: () => studio }
}

it.each(["web", "worker"] as const)("waits for both services when %s finishes first", async first => {
  const sim = simulatedRailway(first)
  expect(await deployProduction(sha, sim.railway, 100)).toBe("ready")
  expect(sim.deployed).toEqual([{ service: "worker", sha }, { service: "web", sha }])
  expect(sim.reachedStudio()).toBe(true)
  expect(sim.receipts).toEqual([expect.objectContaining({ outcome: "ready", sha })])
})

it("records failure without releasing publication or verification", async () => {
  const sim = simulatedRailway("worker", true)
  await expect(deployProduction(sha, sim.railway, 100)).rejects.toThrow("railway-deployment-failed: web")
  expect(sim.reachedStudio()).toBe(false)
  expect(sim.receipts).toEqual([expect.objectContaining({ outcome: "failed" })])
})

it("rejects a stale run before any Railway deploy", async () => {
  const sim = simulatedRailway("worker")
  sim.railway.currentMain = async () => old
  expect(await deployProduction(sha, sim.railway, 100)).toBe("stale")
  expect(sim.deployed).toEqual([])
  expect(sim.reachedStudio()).toBe(false)
  expect(sim.receipts).toEqual([expect.objectContaining({ outcome: "stale" })])
})

it("bounds the wait and keeps a receipt with both observed services", async () => {
  const sim = simulatedRailway("worker", false, true)
  await expect(deployProduction(sha, sim.railway, 20)).rejects.toThrow("railway-deployment-timeout")
  expect(sim.reachedStudio()).toBe(false)
  expect(sim.receipts).toEqual([expect.objectContaining({ outcome: "failed", elapsedMs: 20, observed: expect.objectContaining({ web: expect.any(Array), worker: expect.any(Array) }) })])
})

it("does not accept a previous success or a different commit", async () => {
  const sim = simulatedRailway("worker")
  let studioChecks = 0
  sim.railway.studio = async () => { studioChecks += 1 }
  sim.railway.deployments = async service => sim.deployed.some(value => value.service === service)
    ? [{ id: `${service}-old`, meta: { commitHash: sha }, status: "SUCCESS" }, { id: `${service}-new`, meta: { commitHash: old }, status: "SUCCESS" }]
    : [{ id: `${service}-old`, meta: { commitHash: sha }, status: "SUCCESS" }]
  await expect(deployProduction(sha, sim.railway, 20)).rejects.toThrow("railway-deployment-timeout")
  expect(studioChecks).toBe(0)
})

it("retains failure evidence when the deployment request or Studio check fails", async () => {
  for (const boundary of ["deploy", "studio"] as const) {
    const sim = simulatedRailway("worker")
    sim.railway[boundary] = async () => { throw new Error("unavailable") }
    await expect(deployProduction(sha, sim.railway, 100)).rejects.toThrow("unavailable")
    expect(sim.receipts).toEqual([expect.objectContaining({ outcome: "failed" })])
  }
})
