import { afterAll, describe, expect, it } from "vitest"
import { startServer, type RunningServer } from "../../apps/server/src/main.ts"

let running: RunningServer | null = null

afterAll(async () => {
  await running?.close()
})

describe("server bootstrap", () => {
  it("answers on localhost", async () => {
    running = await startServer(0)
    const response = await fetch(`http://127.0.0.1:${running.port}/api/session`)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ status: "signed-out" })
  })
})
