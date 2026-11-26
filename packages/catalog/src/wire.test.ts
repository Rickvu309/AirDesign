import { describe, expect, it } from "vitest"
import {
  readApprovalRequest,
  readBearer,
  readCapture,
  readClientMetadata,
  readClientRequest,
  readCode,
  readDecks,
  readEmail,
  readHost,
  readLinkToken,
  readNamedDeck,
  readNoFields,
  readRevokeRequest,
  readRun,
  readSessionCookie,
  readTokenRequest,
  storableText,
} from "./index.js"

describe("readCapture", () => {
  it("refuses a slide beside the deck", () => {
    expect(readCapture({ deck: "deck", slide: "a" })).toEqual({ ok: false, refusal: "field" })
  })

  it("reads the deck", () => {
    expect(readCapture({ deck: "deck" })).toEqual({ ok: true, deck: "deck" })
  })
})

describe("readRun", () => {
  it("reads a deck and a run id", () => {
    expect(readRun({ deck: "deck", runId: "run" })).toEqual({ ok: true, deck: "deck", runId: "run" })
  })

  it("refuses anything that is not an object", () => {
    for (const raw of [null, 7, "run", [], undefined]) {
      expect(readRun(raw)).toEqual({ ok: false, refusal: "field" })
    }
  })

  it("refuses an actor or elements beside the run", () => {
    expect(readRun({ deck: "deck", runId: "run", actor: "person" })).toEqual({ ok: false, refusal: "field" })
    expect(readRun({ deck: "deck", runId: "run", elements: [] })).toEqual({ ok: false, refusal: "field" })
  })

  it("refuses a missing deck as a field", () => {
    expect(readRun({ runId: "run" })).toEqual({ ok: false, refusal: "field" })
  })

  it("refuses a malformed deck", () => {
    expect(readRun({ deck: "bad deck", runId: "run" })).toEqual({ ok: false, refusal: "deck" })
  })

  it("refuses a run id that is missing or not 1 to 64 safe characters", () => {
    expect(readRun({ deck: "deck" })).toEqual({ ok: false, refusal: "field" })
    for (const runId of [7, "", "a".repeat(65), "bad run"]) {
      expect(readRun({ deck: "deck", runId })).toEqual({ ok: false, refusal: "field" })
    }
  })
})

const unstorable = ["\u0000", "a\u0000b", "\ud800", "a\ud800b", "\udc00", "a\udc00b", "\udc00\ud800"]
const field = { ok: false, refusal: "field" }
const formType = "application/x-www-form-urlencoded"

describe("storableText", () => {
  it("accepts text with paired surrogates", () => {
    expect(storableText("plain \ud83d\ude00 text")).toBe(true)
    expect(storableText("")).toBe(true)
  })

  for (const text of unstorable) {
    it(`refuses ${JSON.stringify(text)}`, () => {
      expect(storableText(text)).toBe(false)
    })
  }

  for (const value of [undefined, null, 1, true, [], {}]) {
    it(`refuses the non-text ${JSON.stringify(value) ?? "undefined"}`, () => {
      expect(storableText(value)).toBe(false)
    })
  }
})

describe("every reader of text that reaches Postgres refuses what Postgres cannot store", () => {
  const redirect = "https://client.example/cb"
  const challenge = "a".repeat(43)
  const approval = {
    client_id: "c",
    redirect_uri: redirect,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }
  const readers: readonly (readonly [string, (text: string) => unknown])[] = [
    ["an email", (text) => readEmail({ email: `a${text}@example.com` })],
    ["a client name", (text) => readClientMetadata({ redirect_uris: [redirect], client_name: text })],
    ["a redirect address", (text) => readClientMetadata({ redirect_uris: [`${redirect}${text}`] })],
    ["a client id", (text) => readClientRequest({ client_id: text, redirect_uri: redirect })],
    ["a requested redirect", (text) => readClientRequest({ client_id: "c", redirect_uri: text })],
    ["a requested resource", (text) => readClientRequest({ client_id: "c", redirect_uri: redirect, resource: text })],
    ["an approval state", (text) => readApprovalRequest({ ...approval, state: text })],
  ]

  for (const [name, read] of readers) {
    for (const text of unstorable) {
      it(`${name} with ${JSON.stringify(text)}`, () => {
        expect(read(text)).toEqual(field)
      })
    }
  }

  for (const text of unstorable) {
    it(`a form field or name with ${JSON.stringify(text)}`, () => {
      const good: [string, string] = ["grant_type", "refresh_token"]
      expect(readTokenRequest(formType, [good, ["refresh_token", text], ["client_id", "c"]])).toEqual({
        ok: false,
        refusal: "invalid_request",
      })
      expect(readRevokeRequest(formType, [[text, "t"]])).toEqual({ ok: false, refusal: "invalid_request" })
    })

    it(`a link token with ${JSON.stringify(text)}`, () => {
      expect(readLinkToken(text)).toBeUndefined()
    })
  }
})

describe("readSessionCookie", () => {
  const name = "airdesign.session"

  it("reads the session among other cookies", () => {
    expect(readSessionCookie(`a=1; ${name}=to%20ken; b=2`)).toBe("to ken")
  })

  it("uses the first session cookie", () => {
    expect(readSessionCookie(`${name}=first; ${name}=second`)).toBe("first")
  })

  for (const header of [
    undefined,
    7,
    ["x"],
    "",
    "other=1",
    `${name}=`,
    `${name}=%`,
    `${name}=%E0%A4%A`,
    `${name}=%ED%A0%80`,
    `${name}=%00`,
    `${name}=a%00b`,
    `${name}=a\u0000b`,
    `${name}=%E0%A4%A; ${name}=good`,
  ]) {
    it(`refuses ${JSON.stringify(header) ?? "undefined"}`, () => {
      expect(readSessionCookie(header)).toBeUndefined()
    })
  }
})

describe("readBearer", () => {
  it("reads a bearer in any case of the scheme", () => {
    expect(readBearer("Bearer abc.DEF_~+/=-")).toBe("abc.DEF_~+/=-")
    expect(readBearer("bearer abc")).toBe("abc")
  })

  for (const header of [
    undefined,
    1,
    ["Bearer a"],
    "",
    "Bearer",
    "Bearer ",
    "Basic abc",
    "Bearer a b",
    "Bearer a\u0000",
  ]) {
    it(`refuses ${JSON.stringify(header) ?? "undefined"}`, () => {
      expect(readBearer(header)).toBeUndefined()
    })
  }
})

describe("readHost", () => {
  for (const host of ["localhost", "127.0.0.1", "127.0.0.1:8080", "app.example", "[::1]", "[::1]:80", "a:65535"]) {
    it(`reads ${host}`, () => {
      expect(readHost(host)).toBe(host)
    })
  }

  for (const host of [
    undefined,
    7,
    ["localhost"],
    "",
    " ",
    "user@127.0.0.1",
    "user:pass@127.0.0.1",
    "a@b@127.0.0.1",
    "user:pass@localhost:80",
    "127.0.0.1:",
    "127.0.0.1:port",
    "127.0.0.1:65536",
    "127.0.0.1:123456",
    "a b",
    "a\u0000b",
    "caf\u00e9.example",
    "a/b",
    "a?b",
    "a#b",
    "[::1",
    "::1",
  ]) {
    it(`refuses ${JSON.stringify(host) ?? "undefined"}`, () => {
      expect(readHost(host)).toBeUndefined()
    })
  }
})

describe("readLinkToken", () => {
  it("reads a token", () => {
    expect(readLinkToken("abc")).toBe("abc")
  })

  for (const raw of [null, undefined, "", 1]) {
    it(`refuses ${JSON.stringify(raw) ?? "undefined"}`, () => {
      expect(readLinkToken(raw)).toBeUndefined()
    })
  }
})

const wrongBodies = [undefined, null, true, 0, "text", []]

describe("readEmail and readCode", () => {
  it("reads and folds an address", () => {
    expect(readEmail({ email: " A@Example.COM " })).toEqual({ ok: true, email: "a@example.com" })
  })

  it("reads a code", () => {
    expect(readCode({ email: "a@example.com", code: "012345" })).toEqual({
      ok: true,
      email: "a@example.com",
      code: "012345",
    })
  })

  for (const body of [
    ...wrongBodies,
    {},
    { email: 7 },
    { email: "" },
    { email: "no-at" },
    { email: "a@b.co", extra: 1 },
    { email: `${"a".repeat(250)}@b.co` },
  ]) {
    it(`readEmail refuses ${JSON.stringify(body)?.slice(0, 40) ?? "undefined"}`, () => {
      expect(readEmail(body)).toEqual(field)
    })
  }

  for (const body of [
    ...wrongBodies,
    { email: "a@b.co" },
    { email: "a@b.co", code: 123456 },
    { email: "a@b.co", code: "12345" },
    { email: "a@b.co", code: "1234567" },
    { email: "a@b.co", code: "123456", extra: 1 },
  ]) {
    it(`readCode refuses ${JSON.stringify(body) ?? "undefined"}`, () => {
      expect(readCode(body)).toEqual(field)
    })
  }
})

describe("deck list readers", () => {
  it("readNoFields takes only an empty object", () => {
    expect(readNoFields({})).toEqual({ ok: true })
    for (const body of [...wrongBodies, { a: 1 }]) expect(readNoFields(body)).toEqual(field)
  })

  it("readNamedDeck ignores other arguments and refuses a bad deck", () => {
    expect(readNamedDeck({ deck: "d", other: 1 })).toEqual({ ok: true, deck: "d" })
    expect(readNamedDeck({ deck: "a b" })).toEqual({ ok: false, refusal: "deck" })
    const missingDeck = {
      ok: false,
      refusal: "field",
      field: "deck",
      fault: "missing",
      form: "1 to 64 of letters, digits, _ or -.",
    }
    expect(readNamedDeck(JSON.parse('{"__proto__":{"deck":"d"}}'))).toEqual(missingDeck)
    for (const body of [...wrongBodies, {}]) expect(readNamedDeck(body)).toEqual(missingDeck)
  })

  it("readDecks bounds and folds the list", () => {
    expect(readDecks({ decks: ["a", "a", "b"] })).toEqual({ ok: true, decks: ["a", "b"] })
    expect(readDecks({ decks: Array.from({ length: 100 }, () => "a") })).toMatchObject({ ok: true })
    expect(readDecks({ decks: Array.from({ length: 101 }, () => "a") })).toEqual(field)
    expect(readDecks({ decks: [] })).toEqual(field)
    expect(readDecks({ decks: "a" })).toEqual(field)
    expect(readDecks({ decks: [7] })).toEqual({ ok: false, refusal: "deck" })
    expect(readDecks({ decks: ["a"], extra: 1 })).toEqual(field)
  })
})

describe("oauth readers", () => {
  const redirect = "https://client.example/cb"
  const approval = {
    client_id: "c",
    redirect_uri: redirect,
    code_challenge: "a".repeat(43),
    code_challenge_method: "S256",
  }

  it("readClientMetadata reads a client with and without a name", () => {
    expect(readClientMetadata({ redirect_uris: [redirect] })).toEqual({
      ok: true,
      redirectUris: [redirect],
      name: null,
    })
    expect(readClientMetadata({ redirect_uris: [redirect], client_name: "n" })).toMatchObject({ name: "n" })
  })

  it("readClientMetadata reads the six Google redirects Gemini registers, and up to ten", () => {
    const google = ["oauth-redirect-sandbox", "oauth-redirect-test", "oauth-redirect"].flatMap((host) =>
      ["r", "a"].map(
        (path) => `https://${host}.googleusercontent.com/${path}/user_bound_custom-mcp-f6492779cacd5f618adb99b9`,
      ),
    )
    expect(readClientMetadata({ client_name: "Google", redirect_uris: google })).toEqual({
      ok: true,
      redirectUris: google,
      name: "Google",
    })
    const ten = Array.from({ length: 10 }, (_, index) => `${redirect}${String(index)}`)
    expect(readClientMetadata({ redirect_uris: ten })).toMatchObject({ ok: true, redirectUris: ten })
  })

  for (const body of [
    ...wrongBodies,
    {},
    { redirect_uris: "x" },
    { redirect_uris: [] },
    { redirect_uris: [7] },
    { redirect_uris: ["https://a.example/#x"] },
    { redirect_uris: [`https://a.example/${"x".repeat(2000)}`] },
    { redirect_uris: Array.from({ length: 11 }, () => redirect) },
    { redirect_uris: [redirect], client_name: 7 },
    { redirect_uris: [redirect], client_name: "x".repeat(201) },
  ]) {
    it(`readClientMetadata refuses ${JSON.stringify(body)?.slice(0, 60) ?? "undefined"}`, () => {
      expect(readClientMetadata(body)).toEqual(field)
    })
  }

  it("readClientRequest reads the fields and refuses a resource that is not text", () => {
    expect(readClientRequest({ client_id: "c", redirect_uri: redirect, resource: "r" })).toEqual({
      ok: true,
      clientId: "c",
      redirectUri: redirect,
      resource: "r",
    })
    expect(readClientRequest({ client_id: "c", redirect_uri: redirect, resource: 7 })).toEqual({
      ok: false,
      refusal: "resource",
    })
    for (const body of [...wrongBodies, {}, { client_id: 7, redirect_uri: redirect }]) {
      expect(readClientRequest(body)).toEqual(field)
    }
  })

  it("readApprovalRequest reads the challenge and the state", () => {
    expect(readApprovalRequest({ ...approval, state: "s" })).toMatchObject({
      ok: true,
      challenge: approval.code_challenge,
      state: "s",
    })
    expect(readApprovalRequest(approval)).toMatchObject({ ok: true, state: undefined })
  })

  for (const change of [
    { code_challenge_method: "plain" },
    { code_challenge: 7 },
    { code_challenge: "a".repeat(42) },
    { code_challenge: "a".repeat(44) },
    { code_challenge: `${"a".repeat(42)}!` },
  ]) {
    it(`readApprovalRequest refuses the challenge ${JSON.stringify(change).slice(0, 60)}`, () => {
      expect(readApprovalRequest({ ...approval, ...change })).toEqual({ ok: false, refusal: "challenge" })
    })
  }

  const code: readonly [string, string][] = [
    ["grant_type", "authorization_code"],
    ["code", "c"],
    ["code_verifier", "v"],
    ["client_id", "id"],
    ["redirect_uri", redirect],
  ]
  const refresh: readonly [string, string][] = [
    ["grant_type", "refresh_token"],
    ["refresh_token", "r"],
    ["client_id", "id"],
  ]
  const invalid = { ok: false, refusal: "invalid_request" }

  it("readTokenRequest reads both grants", () => {
    expect(readTokenRequest(formType, code)).toEqual({
      ok: true,
      grant: "authorization_code",
      code: "c",
      verifier: "v",
      clientId: "id",
      redirectUri: redirect,
      resource: undefined,
    })
    expect(readTokenRequest(`${formType}; charset=utf-8`, [...refresh, ["resource", "x"]])).toEqual({
      ok: true,
      grant: "refresh_token",
      secret: "r",
      clientId: "id",
      resource: "x",
    })
  })

  it("readTokenRequest refuses another grant and every missing field", () => {
    expect(readTokenRequest(formType, [["grant_type", "password"]])).toEqual({
      ok: false,
      refusal: "unsupported_grant_type",
    })
    expect(readTokenRequest(formType, [])).toEqual(invalid)
    for (const pairs of [code, refresh]) {
      for (const [name] of pairs) {
        expect(
          readTokenRequest(
            formType,
            pairs.filter(([key]) => key !== name),
          ),
        ).toEqual(invalid)
      }
    }
  })

  it("the form readers refuse a duplicate field and a wrong content type", () => {
    expect(readTokenRequest(formType, [...refresh, ["client_id", "other"]])).toEqual(invalid)
    expect(
      readRevokeRequest(formType, [
        ["token", "a"],
        ["token", "b"],
      ]),
    ).toEqual(invalid)
    for (const type of [undefined, 7, "", ";;;", "application/json"]) {
      expect(readTokenRequest(type, refresh)).toEqual(invalid)
      expect(readRevokeRequest(type, [["token", "a"]])).toEqual(invalid)
    }
  })

  it("readRevokeRequest reads the token, or no token", () => {
    expect(readRevokeRequest(formType, [["token", "a"]])).toEqual({ ok: true, token: "a" })
    expect(readRevokeRequest(formType, [])).toEqual({ ok: true, token: undefined })
  })
})
