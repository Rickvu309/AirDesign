import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { startServer, type RunningServer } from "../../apps/server/src/main.ts"

let running: RunningServer | null = null

beforeAll(async () => {
  process.env.AIRDESIGN_EXPOSE_INBOX = "1"
  running = await startServer(0, { operationsPath: ":memory:", accessPath: "memory://" })
})

afterAll(async () => {
  await running?.close()
})

describe("server bootstrap", () => {
  it("answers on localhost", async () => {
    const server = requiredServer()
    const response = await fetch(`http://127.0.0.1:${server.port}/api/session`)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ status: "signed-out" })
  })

  it("returns the session cookie and keeps answering", async () => {
    const server = requiredServer()
    const base = `http://127.0.0.1:${server.port}`
    const email = "cookie@example.com"
    const issued = await post(base, "/api/access/intent", { kind: "home" })
    const intent = await issued.json() as { token: string }
    const sent = await post(base, "/api/access/email", { email, intent: intent.token })
    expect(sent.status).toBe(200)
    const inbox = await fetch(`${base}/api/dev/inbox?to=${encodeURIComponent(email)}`)
    const messages = await inbox.json() as { messages: Array<{ code: string }> }
    const code = messages.messages.at(-1)?.code
    const verified = await post(base, "/api/access/code", { email, code, intent: intent.token })
    expect(verified.status).toBe(200)
    expect(verified.headers.get("set-cookie")).toContain("session_token")
    await expect(verified.json()).resolves.toMatchObject({ status: "signed-in", kind: "home" })
    const again = await fetch(`${base}/api/session`)
    expect(again.status).toBe(200)
  })
})

function requiredServer(): RunningServer {
  if (!running) {
    throw new Error("server-not-started")
  }
  return running
}

function post(base: string, path: string, body: unknown): Promise<Response> {
  return fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}
