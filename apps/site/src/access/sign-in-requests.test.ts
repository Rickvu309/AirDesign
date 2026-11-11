import { createServer, type IncomingMessage, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { afterEach, describe, expect, it } from "vitest"
import { requestSignInEmail, submitSignInCode } from "./sign-in-requests"

type Received = { method: string | undefined; path: string | undefined; body: unknown }

let server: Server | undefined

async function startApi(status: number): Promise<{ base: string; received: Received[] }> {
  const received: Received[] = []
  server = createServer(async (request: IncomingMessage, response) => {
    const chunks: Buffer[] = []
    for await (const chunk of request) {
      chunks.push(chunk as Buffer)
    }
    received.push({ method: request.method, path: request.url, body: JSON.parse(Buffer.concat(chunks).toString()) })
    response.writeHead(status, { "content-type": "application/json" })
    response.end(JSON.stringify({ ok: status < 300 }))
  })
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve))
  const { port } = server.address() as AddressInfo
  return { base: `http://127.0.0.1:${port}`, received }
}

afterEach(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()))
  server = undefined
})

describe("requestSignInEmail", () => {
  it("posts the email as JSON to /sign-in/email and goes to the check page on 202", async () => {
    const api = await startApi(202)
    const destination = await requestSignInEmail(api.base, "ada@example.com")
    expect(api.received).toEqual([{ method: "POST", path: "/sign-in/email", body: { email: "ada@example.com" } }])
    expect(destination).toBe("/sign-in/check")
  })

  it.each([400, 500])("stays on the page on %i", async (status) => {
    const api = await startApi(status)
    expect(await requestSignInEmail(api.base, "ada@example.com")).toBeNull()
  })

  it("stays on the page when the API is unreachable", async () => {
    expect(await requestSignInEmail("http://127.0.0.1:1", "ada@example.com")).toBeNull()
  })
})

describe("submitSignInCode", () => {
  it("posts the email and code to /sign-in/code and goes to the app origin plus the remembered path on 200", async () => {
    const api = await startApi(200)
    const destination = await submitSignInCode(api.base, "https://app.airdesign.app", "ada@example.com", "123456", "/thin/abc?x=1")
    expect(api.received).toEqual([{ method: "POST", path: "/sign-in/code", body: { email: "ada@example.com", code: "123456" } }])
    expect(destination).toBe("https://app.airdesign.app/thin/abc?x=1")
  })

  it("goes to the path alone when the app origin is unset", async () => {
    const api = await startApi(200)
    expect(await submitSignInCode(api.base, undefined, "ada@example.com", "123456", "/thin/abc?x=1")).toBe("/thin/abc?x=1")
  })

  it.each(["//evil.example", "https://evil.example", "/\\evil", null])("goes to the app root for the remembered value %s", async (next) => {
    const api = await startApi(200)
    expect(await submitSignInCode(api.base, "https://app.airdesign.app", "ada@example.com", "123456", next)).toBe("https://app.airdesign.app/")
  })

  it.each([400, 401, 500])("stays on the page on %i", async (status) => {
    const api = await startApi(status)
    expect(await submitSignInCode(api.base, "https://app.airdesign.app", "ada@example.com", "123456", "/")).toBeNull()
  })
})
