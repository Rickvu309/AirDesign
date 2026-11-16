import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { publishCluster, publishedCluster } from "./postgres-setup.js"

const folders: string[] = []

async function clusterFile(): Promise<string> {
  const folder = await mkdtemp(path.join(os.tmpdir(), "cluster-"))
  folders.push(folder)
  return path.join(folder, "cluster.json")
}

afterEach(async () => {
  await Promise.all(folders.splice(0).map((folder) => rm(folder, { recursive: true, force: true })))
})

describe("the published cluster", () => {
  it("waits for a cluster published after the wait starts", async () => {
    const file = await clusterFile()
    const waiting = publishedCluster<{ readonly port: number }>(file, 10_000)
    await publishCluster(file, { port: 5432 })
    await expect(waiting).resolves.toEqual({ port: 5432 })
  })

  it("reads a cluster published before the wait starts", async () => {
    const file = await clusterFile()
    await publishCluster(file, { port: 5433 })
    await expect(publishedCluster(file, 10_000)).resolves.toEqual({ port: 5433 })
  })

  it("fails with the reason a cluster could not start", async () => {
    const file = await clusterFile()
    const failed = expect(publishedCluster(file, 10_000)).rejects.toThrow("PostgreSQL 18 was not found.")
    await publishCluster(file, { error: "PostgreSQL 18 was not found." })
    await failed
  })

  it("fails when no cluster is published in time", async () => {
    const file = await clusterFile()
    await expect(publishedCluster(file, 50)).rejects.toThrow(file)
  })
})
