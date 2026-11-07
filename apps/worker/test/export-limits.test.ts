import { it, expect, describe, vi } from "vitest"
import { mkdtemp, rm } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import os from "node:os"
import path from "node:path"
import { createHistoryStore } from "../../server/src/db/history-store.ts"
import { fixtureDeck } from "../../../packages/deck/src/fixture.ts"
import { deliverExport } from "../src/export/deliver.ts"

describe.each(["systemd", "container"])("%s PDF resource limits", mode => {
  it("stores the wall-clock kill and signal instead of a null exit code", async () => {
    vi.stubEnv("AIRDESIGN_ISOLATION", mode)
    vi.stubEnv("PLAYWRIGHT_BROWSERS_PATH", path.join(os.homedir(), ".cache/ms-playwright"))
    const root = await mkdtemp(path.join(os.homedir(), "tmp/export-deadline-"))
    const store = await createHistoryStore({ kind: "pglite" })
    const person = { personId: "export-limit-person" }
    try {
      const deck = await store.catalog.create(person, randomUUID(), "Deadline", "", fixtureDeck(20, 50))
      const job = await store.exports.submit(person, randomUUID(), deck.id, { format: "pdf", timing: "now", slides: [], expectedSeq: 0, allowIssues: true })
      await deliverExport({ ...store.exports, claim: async () => {
        const claim = await store.exports.claim()
        return claim ? { ...claim, deadline: Date.now() + 100 } : null
      } }, root)
      expect(await store.exports.status(person, job.id)).toMatchObject({ kind: "failed", failure: { kind: "limit", limit: "wall-clock", signal: "SIGKILL" } })
    } finally { await store.close(); await rm(root, { recursive: true, force: true }); vi.unstubAllEnvs() }
  }, 20000)

  it("exports a real PDF beyond the old lease with memory and CPU accounting enabled", async () => {
    vi.stubEnv("AIRDESIGN_ISOLATION", mode)
    vi.stubEnv("PLAYWRIGHT_BROWSERS_PATH", path.join(os.homedir(), ".cache/ms-playwright"))
    if (mode === "container") vi.stubEnv("PLAYWRIGHT_BROWSERS_PATH", undefined)
    const root = await mkdtemp(path.join(os.homedir(), "tmp/export-load-"))
    const store = await createHistoryStore({ kind: "pglite" })
    const person = { personId: "export-load-person" }
    try {
      const deck = await store.catalog.create(person, randomUUID(), "Load", "", fixtureDeck(20, 50))
      const job = await store.exports.submit(person, randomUUID(), deck.id, { format: "pdf", timing: "now", slides: [], expectedSeq: 0, allowIssues: true })
      const result = await deliverExport(store.exports, root)
      expect(await store.exports.status(person, job.id)).toMatchObject({ kind: "ready" })
      expect(result?.committed).toBe(true)
      expect((await store.exports.artifact(person, job.id)).bytes.subarray(0, 5).toString()).toBe("%PDF-")
    } finally { await store.close(); await rm(root, { recursive: true, force: true }); vi.unstubAllEnvs() }
  }, 20000)
})

it.each(["systemd", "container"])("records a %s memory-limit kill", async mode => {
  const { exportLimits } = await import("../../../packages/operations/src/export-failure.ts")
  const original = exportLimits.memoryBytes
  vi.stubEnv("AIRDESIGN_ISOLATION", mode)
  vi.stubEnv("PLAYWRIGHT_BROWSERS_PATH", path.join(os.homedir(), ".cache/ms-playwright"))
  const root = await mkdtemp(path.join(os.homedir(), "tmp/export-memory-"))
  const store = await createHistoryStore({ kind: "pglite" })
  const person = { personId: "export-memory-person" }
  try {
    const deck = await store.catalog.create(person, randomUUID(), "Memory", "", fixtureDeck(20, 50))
    const job = await store.exports.submit(person, randomUUID(), deck.id, { format: "pdf", timing: "now", slides: [], expectedSeq: 0, allowIssues: true })
    exportLimits.memoryBytes = (mode === "systemd" ? 64 : 256) * 1024 * 1024
    await deliverExport(store.exports, root)
    expect(await store.exports.status(person, job.id)).toMatchObject({ kind: "failed", failure: { kind: "limit", limit: "memory", signal: expect.stringMatching(/^SIG(KILL|TERM)$/) } })
  } finally { exportLimits.memoryBytes = original; await store.close(); await rm(root, { recursive: true, force: true }); vi.unstubAllEnvs() }
}, 20000)
