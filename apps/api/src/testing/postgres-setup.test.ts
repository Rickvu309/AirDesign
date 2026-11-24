import { spawn } from "node:child_process"
import { once } from "node:events"
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Client } from "pg"
import {
  publishCluster,
  publishedCluster,
  startEmptyCluster,
  startOwnedEmptyCluster,
  testWorkerConnections,
} from "./postgres-setup.js"

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

describe("the test cluster", () => {
  it("lets every test worker this machine runs hold its connections at once", async () => {
    const cluster = await startEmptyCluster()
    try {
      const admin = new Client({ connectionString: cluster.admin })
      await admin.connect()
      const answer = await admin.query<{ max_connections: string }>("show max_connections")
      await admin.end()
      expect(Number(answer.rows[0]?.max_connections)).toBeGreaterThanOrEqual(
        testWorkerConnections(os.availableParallelism()),
      )
    } finally {
      await cluster.stop()
    }
  }, 120_000)
})

it("rolls back an owned cluster when the bootstrap connection is rejected", async () => {
  const dir = path.join(path.dirname(await clusterFile()), "postgres")
  vi.stubEnv("PGOPTIONS", "-c air_design_test_unknown_option=on")
  try {
    await expect(startOwnedEmptyCluster({ dir, signal: new AbortController().signal })).rejects.toThrow(
      'unrecognized configuration parameter "air_design_test_unknown_option"',
    )
    await expect(access(dir)).rejects.toMatchObject({ code: "ENOENT" })
  } finally {
    vi.unstubAllEnvs()
  }
})

it("keeps its data when the pid file names a non-Postgres process with the same -D argument", async () => {
  const dir = path.join(path.dirname(await clusterFile()), "postgres")
  const cluster = await startOwnedEmptyCluster({ dir, signal: new AbortController().signal })
  const data = path.join(dir, "data")
  const pidFile = path.join(data, "postmaster.pid")
  const original = await readFile(pidFile)
  const other = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)", "--", "-D", data])
  const ended = once(other, "exit")
  try {
    await once(other, "spawn")
    await writeFile(pidFile, `${String(other.pid)}\n${data}\n`)
    await expect(cluster.stop()).rejects.toThrow("could not verify the postmaster")
    expect(other.exitCode).toBeNull()
    expect(other.signalCode).toBeNull()
  } finally {
    await writeFile(pidFile, original)
    other.kill("SIGKILL")
    await ended
    await cluster.stop()
  }
}, 30_000)
