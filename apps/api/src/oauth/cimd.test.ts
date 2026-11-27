import { describe, expect, it } from "vitest"

import { clientAddress, documentCap, documentFresh, documentWait, fetchClientDocument } from "./cimd.js"
import { documentBytes, servedDocuments } from "./testing/served-documents.js"

const id = "https://agent.example.com/oauth/client.json"
const agentHost = { "agent.example.com": ["93.184.216.34"] }
const document = {
  client_id: id,
  client_name: "Agent",
  redirect_uris: ["https://agent.example.com/callback", "http://localhost/callback"],
  grant_types: ["authorization_code", "refresh_token"],
  response_types: ["code"],
  token_endpoint_auth_method: "none",
}

function serving(body: unknown, hosts: Readonly<Record<string, readonly string[] | "hang">> = agentHost) {
  const served = servedDocuments(hosts)
  served.pages.set(id, { status: 200, body: documentBytes(body) })
  return served
}

describe("a client address", () => {
  it.each([
    [id, true],
    ["https://claude.ai/oauth/claude-code-client-metadata", true],
    ["https://vscode.dev/oauth/client-metadata.json", true],
    ["http://agent.example.com/oauth/client.json", false],
    ["https://agent.example.com", false],
    ["https://agent.example.com/", false],
    ["https://user@agent.example.com/client.json", false],
    ["https://user:secret@agent.example.com/client.json", false],
    ["https://agent.example.com:8443/client.json", false],
    ["https://agent.example.com:443/client.json", false],
    ["https://agent.example.com/client.json?v=1", false],
    ["https://agent.example.com/client.json?", false],
    ["https://agent.example.com/client.json#top", false],
    ["https://agent.example.com/client.json#", false],
    ["https://agent.example.com/a/../client.json", false],
    ["https://agent.example.com/a/./client.json", false],
    ["https://agent.example.com/%2e%2e/client.json", false],
    ["https://AGENT.example.com/client.json", false],
    [`https://agent.example.com/${"a".repeat(2048)}`, false],
    ["not a url", false],
    ["", false],
  ])("%s is one: %s", (raw, taken) => {
    expect(clientAddress(raw) !== null).toBe(taken)
  })
})

describe("fetching a client's metadata document", () => {
  it("reads the name and redirects, asking once at the address it resolved", async () => {
    const served = serving(document)
    expect(await fetchClientDocument(id, served.net)).toEqual({
      ok: true,
      name: "Agent",
      redirectUris: document.redirect_uris,
    })
    expect(served.asked).toEqual([{ url: id, at: "93.184.216.34" }])
  })

  it("waits three seconds, reads under five kilobytes and stays fresh five minutes", () => {
    expect([documentWait, documentCap, documentFresh]).toEqual([3_000, 5_120, 300_000])
  })

  it("refuses an address that is not a client address, without asking", async () => {
    const served = serving(document)
    for (const raw of ["http://agent.example.com/oauth/client.json", "https://agent.example.com/", "nope"]) {
      expect(await fetchClientDocument(raw, served.net)).toEqual({ ok: false, refusal: "address" })
    }
    expect(served.asked).toEqual([])
  })

  it.each([
    "127.0.0.1",
    "10.0.0.5",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "::",
    "fe80::1",
    "fc00::1",
    "fd12:3456::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::ffff:a9fe:a9fe",
    "::ffff:10.0.0.1",
    "::ffff:0:7f00:1",
    "64:ff9b::7f00:1",
    "2002:7f00:1::",
  ])("refuses a host that resolves to %s, without asking it", async (address) => {
    const served = serving(document, { "agent.example.com": [address] })
    expect(await fetchClientDocument(id, served.net)).toEqual({ ok: false, refusal: "private" })
    expect(served.asked).toEqual([])
  })

  it("refuses a host with one private address among public ones", async () => {
    const served = serving(document, { "agent.example.com": ["93.184.216.34", "2606:2800:220:1::1", "10.0.0.5"] })
    expect(await fetchClientDocument(id, served.net)).toEqual({ ok: false, refusal: "private" })
    expect(served.asked).toEqual([])
  })

  it("refuses a private literal address and a name that resolves to loopback", async () => {
    const served = servedDocuments({ localhost: ["127.0.0.1", "::1"] })
    for (const raw of [
      "https://127.0.0.1/client.json",
      "https://[::1]/client.json",
      "https://[::ffff:7f00:1]/client.json",
      "https://169.254.169.254/latest/meta-data",
      "https://[fd00::1]/client.json",
      "https://localhost/client.json",
    ]) {
      expect(await fetchClientDocument(raw, served.net)).toEqual({ ok: false, refusal: "private" })
    }
    expect(served.asked).toEqual([])
  })

  it.each([301, 302, 303, 307, 308])("does not follow a %i redirect", async (status) => {
    const served = serving(document, { ...agentHost, "metadata.example.com": ["169.254.169.254"] })
    served.pages.set(id, { status, location: "https://metadata.example.com/latest" })
    expect(await fetchClientDocument(id, served.net)).toEqual({ ok: false, refusal: "status" })
    expect(served.asked.map((each) => each.url)).toEqual([id])
  })

  it.each([204, 404, 500])("refuses a %i answer", async (status) => {
    const served = serving(document)
    served.pages.set(id, { status, body: documentBytes(document) })
    expect(await fetchClientDocument(id, served.net)).toEqual({ ok: false, refusal: "status" })
  })

  it("refuses five kilobytes or more by stated length or by bytes, and takes one just under", async () => {
    const padded = (size: number) => {
      const bare = documentBytes({ ...document, padding: "" }).byteLength
      return documentBytes({ ...document, padding: "x".repeat(size - bare) })
    }
    expect(padded(documentCap).byteLength).toBe(documentCap)
    const served = serving(document)
    served.pages.set(id, { status: 200, length: documentCap, body: documentBytes(document) })
    expect(await fetchClientDocument(id, served.net)).toEqual({ ok: false, refusal: "size" })
    served.pages.set(id, { status: 200, body: padded(documentCap) })
    expect(await fetchClientDocument(id, served.net)).toEqual({ ok: false, refusal: "size" })
    served.pages.set(id, { status: 200, body: padded(documentCap - 1) })
    expect(await fetchClientDocument(id, served.net)).toMatchObject({ ok: true })
  })

  it("gives up when the host does not answer or its name does not resolve within the wait", async () => {
    const quiet = serving(document)
    quiet.pages.set(id, { status: 200, hang: true })
    const started = performance.now()
    expect(await fetchClientDocument(id, quiet.net, { wait: 50 })).toEqual({ ok: false, refusal: "timeout" })
    const stuck = serving(document, { "agent.example.com": "hang" })
    expect(await fetchClientDocument(id, stuck.net, { wait: 50 })).toEqual({ ok: false, refusal: "timeout" })
    expect(performance.now() - started).toBeLessThan(2_000)
  })

  it("refuses a host whose name does not resolve", async () => {
    const served = serving(document, {})
    expect(await fetchClientDocument(id, served.net)).toEqual({ ok: false, refusal: "unreachable" })
  })

  it.each([
    ["names another client", { ...document, client_id: "https://agent.example.com/oauth/other.json" }],
    ["names itself with a trailing slash", { ...document, client_id: `${id}/` }],
    ["names itself in capitals", { ...document, client_id: id.toUpperCase() }],
    ["names no client", { ...document, client_id: undefined }],
    ["has no name", { ...document, client_name: undefined }],
    ["has a name that is not text", { ...document, client_name: 7 }],
    ["holds a client secret", { ...document, client_secret: "shh" }],
    ["holds a client secret expiry", { ...document, client_secret_expires_at: 0 }],
    ["signs in with a shared secret", { ...document, token_endpoint_auth_method: "client_secret_basic" }],
    ["signs in with a private key", { ...document, token_endpoint_auth_method: "private_key_jwt" }],
    [
      "lists only a private key sign-in",
      {
        ...document,
        token_endpoint_auth_method: undefined,
        token_endpoint_auth_methods_supported: ["private_key_jwt"],
      },
    ],
    ["leaves out the code grant", { ...document, grant_types: ["client_credentials"] }],
    ["leaves out the code response", { ...document, response_types: ["token"] }],
    ["lists no redirect", { ...document, redirect_uris: [] }],
    ["lists a plain http redirect off loopback", { ...document, redirect_uris: ["http://agent.example.com/cb"] }],
    ["lists a redirect with a fragment", { ...document, redirect_uris: ["https://agent.example.com/cb#x"] }],
    [
      "lists eleven redirects",
      { ...document, redirect_uris: Array.from({ length: 11 }, (_, at) => `https://agent.example.com/${String(at)}`) },
    ],
  ])("refuses a document that %s", async (_label, body) => {
    expect(await fetchClientDocument(id, serving(body).net)).toEqual({ ok: false, refusal: "document" })
  })

  it("refuses an answer that is not a JSON object", async () => {
    const served = serving(document)
    for (const body of [new TextEncoder().encode("<html></html>"), documentBytes([document]), documentBytes("x")]) {
      served.pages.set(id, { status: 200, body })
      expect(await fetchClientDocument(id, served.net)).toEqual({ ok: false, refusal: "document" })
    }
  })

  it("takes a document that leaves its sign-in method, grants and responses to the defaults", async () => {
    const bare = { client_id: id, client_name: "Agent", redirect_uris: ["https://agent.example.com/callback"] }
    expect(await fetchClientDocument(id, serving(bare).net)).toMatchObject({ ok: true })
    const listed = { ...bare, token_endpoint_auth_methods_supported: ["private_key_jwt", "none"] }
    expect(await fetchClientDocument(id, serving(listed).net)).toMatchObject({ ok: true })
  })
})
