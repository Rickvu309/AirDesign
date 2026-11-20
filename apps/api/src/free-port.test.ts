import { createServer, type Server } from "node:net"
import { afterEach, expect, it } from "vitest"

import { freePort, onFreePort } from "./free-port.js"
import { startEmptyCluster } from "./postgres-setup.js"

const open: Server[] = []

afterEach(async () => {
  await Promise.all(open.splice(0).map((server) => new Promise((resolve) => server.close(resolve))))
})

const listen = (port: number): Promise<Server> =>
  new Promise((resolve, reject) => {
    const server = createServer()
    open.push(server)
    server.once("error", (error: NodeJS.ErrnoException) =>
      reject(new Error(`could not bind: ${error.code === "EADDRINUSE" ? "Address already in use" : String(error)}`)),
    )
    server.listen(port, "127.0.0.1", () => resolve(server))
  })

it("tries another port when the one picked is taken before the server binds it", async () => {
  const taken = await listen(0)
  const heldPort = (taken.address() as { port: number }).port
  const picks: number[] = []
  const answer = await onFreePort({
    pick: async () => {
      const port = picks.length === 0 ? heldPort : 0
      picks.push(port)
      return port
    },
    start: async (port) => (await listen(port)).address(),
  })
  expect(picks).toHaveLength(2)
  expect((answer as { port: number }).port).not.toBe(heldPort)
})

it("gives up after the tries and shows the last refusal", async () => {
  const taken = await listen(0)
  const heldPort = (taken.address() as { port: number }).port
  await expect(onFreePort({ pick: async () => heldPort, start: (port) => listen(port), tries: 3 })).rejects.toThrow(
    "Address already in use",
  )
})

it("stops at once on a refusal that is not about the port", async () => {
  let started = 0
  await expect(
    onFreePort({
      pick: async () => 1,
      start: async () => {
        started += 1
        throw new Error("data directory has wrong ownership")
      },
    }),
  ).rejects.toThrow("wrong ownership")
  expect(started).toBe(1)
})

it("starts a Postgres cluster on the next port when the first one is taken before it binds", async () => {
  const taken = await listen(0)
  const heldPort = (taken.address() as { port: number }).port
  const picks: number[] = []
  const cluster = await startEmptyCluster(async () => {
    const port = picks.length === 0 ? heldPort : await freePort()
    picks.push(port)
    return port
  })
  try {
    expect(picks).toHaveLength(2)
    expect(cluster.port).toBe(picks[1])
  } finally {
    await cluster.stop()
  }
}, 60_000)
