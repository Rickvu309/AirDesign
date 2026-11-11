import { describe, expect, it } from "vitest"

import { readStartSettings } from "./start-settings.js"

const good = {
  SESSION_DATABASE_URL: "postgres://session:secret-one@127.0.0.1:5432/api",
  DECK_DATABASE_URL: "postgres://deck:secret-two@127.0.0.1:5432/api",
  LISTEN_DATABASE_URL: "postgres://listen:secret-three@127.0.0.1:5432/api",
  PUBLIC_ORIGIN: "https://app.example",
  SITE_ORIGIN: "https://site.example",
  MCP_RESOURCE: "https://mcp.example/mcp",
  RESEND_API_KEY: "resend-secret",
  RESEND_FROM: "sign-in@app.example",
}

function refused(values: Record<string, string | undefined>): string | undefined {
  const outcome = readStartSettings({ ...good, ...values })
  return "refusal" in outcome ? outcome.refusal : undefined
}

const notOrigins = [
  undefined,
  "",
  "http://app.example",
  "https://app.example/path",
  "https://app.example/",
  "app",
  "https://user:secret@app.example",
  "https://app.example:443",
  "https://app.example?x=1",
  "https://app.example#x",
  "HTTPS://APP.EXAMPLE",
  "https://app.example\u0000",
  "https://[",
]

describe("readStartSettings", () => {
  it("starts without storage when every R2 setting is absent or empty", () => {
    expect(readStartSettings(good)).toMatchObject({ r2: undefined })
    expect(
      readStartSettings({ ...good, R2_ACCOUNT_ID: "", R2_ACCESS_KEY_ID: "", R2_SECRET_ACCESS_KEY: "", R2_BUCKET: "" }),
    ).toMatchObject({ r2: undefined })
  })

  it("reads all four R2 settings together", () => {
    expect(
      readStartSettings({
        ...good,
        R2_ACCOUNT_ID: "example",
        R2_ACCESS_KEY_ID: "example",
        R2_SECRET_ACCESS_KEY: "example",
        R2_BUCKET: "originals",
      }),
    ).toMatchObject({
      r2: { accountId: "example", accessKeyId: "example", secretAccessKey: "example", bucket: "originals" },
    })
  })

  it("names the first missing R2 setting for every partial configuration", () => {
    const names = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]
    for (let mask = 1; mask < 15; mask++) {
      const values = Object.fromEntries(names.map((name, index) => [name, mask & (1 << index) ? "example" : ""]))
      expect(refused(values)).toBe(names.find((_, index) => !(mask & (1 << index))))
    }
  })

  it("returns every setting the entry needs", () => {
    expect(
      readStartSettings({ ...good, PORT: "8080", COOKIE_DOMAIN: "link.example", API_HOSTS: " A.example, ,b.example " }),
    ).toEqual({
      sessionUrl: good.SESSION_DATABASE_URL,
      deckUrl: good.DECK_DATABASE_URL,
      listenUrl: good.LISTEN_DATABASE_URL,
      port: 8080,
      publicOrigin: good.PUBLIC_ORIGIN,
      siteOrigin: good.SITE_ORIGIN,
      resource: good.MCP_RESOURCE,
      cookieDomain: "link.example",
      hosts: ["a.example", "b.example"],
      commit: undefined,
      smokeToken: undefined,
      resendKey: good.RESEND_API_KEY,
      resendFrom: good.RESEND_FROM,
      r2: undefined,
    })
  })

  it("reads the commit and the smoke token", () => {
    expect(readStartSettings({ ...good, RAILWAY_GIT_COMMIT_SHA: "abc123", SMOKE_TOKEN: "smoke-secret" })).toMatchObject(
      {
        commit: "abc123",
        smokeToken: "smoke-secret",
      },
    )
  })

  it("leaves the commit and the smoke token absent when empty or unset", () => {
    expect(readStartSettings(good)).toMatchObject({ commit: undefined, smokeToken: undefined })
    expect(readStartSettings({ ...good, RAILWAY_GIT_COMMIT_SHA: "", SMOKE_TOKEN: "" })).toMatchObject({
      commit: undefined,
      smokeToken: undefined,
    })
  })

  it("does not refuse to start for a missing commit or smoke token", () => {
    expect(refused({ RAILWAY_GIT_COMMIT_SHA: undefined, SMOKE_TOKEN: undefined })).toBeUndefined()
  })

  it("defaults the port, the cookie domain and the hosts", () => {
    expect(readStartSettings(good)).toMatchObject({ port: 3000, cookieDomain: undefined, hosts: undefined })
    expect(readStartSettings({ ...good, PORT: "", COOKIE_DOMAIN: "", API_HOSTS: " , " })).toMatchObject({
      port: 3000,
      cookieDomain: undefined,
      hosts: undefined,
    })
  })

  it("accepts the edges of the port range", () => {
    expect(readStartSettings({ ...good, PORT: "1" })).toMatchObject({ port: 1 })
    expect(readStartSettings({ ...good, PORT: "65535" })).toMatchObject({ port: 65535 })
  })

  describe("exits when a database url is missing", () => {
    for (const name of ["SESSION_DATABASE_URL", "DECK_DATABASE_URL", "LISTEN_DATABASE_URL"]) {
      it(name, () => {
        expect(refused({ [name]: undefined })).toBe(name)
      })
    }

    it("names every missing url on one line", () => {
      expect(refused({ SESSION_DATABASE_URL: undefined, LISTEN_DATABASE_URL: undefined })).toBe(
        "SESSION_DATABASE_URL LISTEN_DATABASE_URL",
      )
    })

    it("puts no url into the refusal", () => {
      const outcome = readStartSettings({ ...good, DECK_DATABASE_URL: undefined })
      expect(JSON.stringify(outcome)).not.toContain("postgres://")
      expect(JSON.stringify(outcome)).not.toContain("secret")
    })
  })

  describe("exits when a database url is empty", () => {
    for (const name of ["SESSION_DATABASE_URL", "DECK_DATABASE_URL", "LISTEN_DATABASE_URL"]) {
      it(name, () => {
        expect(refused({ [name]: "" })).toBe(name)
      })
    }
  })

  describe("exits when the port is not a port", () => {
    for (const port of [
      "0",
      "abc",
      "70000",
      "1e4",
      "0x1F90",
      " 8080",
      "8080 ",
      "-1",
      "1.5",
      "65536",
      "\u0663\u0660\u0660\u0660",
      "99999999999999999999",
      "8080\u0000",
    ]) {
      it(JSON.stringify(port), () => {
        expect(refused({ PORT: port })).toBe("PORT")
      })
    }
  })

  describe("exits when the public origin is missing or not an origin", () => {
    for (const value of notOrigins) {
      it(JSON.stringify(value), () => {
        expect(refused({ PUBLIC_ORIGIN: value })).toBe("PUBLIC_ORIGIN")
      })
    }
  })

  describe("exits when the site origin is missing or not an origin", () => {
    for (const value of notOrigins) {
      it(JSON.stringify(value), () => {
        expect(refused({ SITE_ORIGIN: value })).toBe("SITE_ORIGIN")
      })
    }
  })

  describe("exits when the MCP address is missing or not an https url", () => {
    for (const value of [
      undefined,
      "",
      "http://mcp.example/mcp",
      "not a url",
      "ftp://mcp.example/mcp",
      "https:",
      "https://[",
    ]) {
      it(JSON.stringify(value), () => {
        expect(refused({ MCP_RESOURCE: value })).toBe("MCP_RESOURCE")
      })
    }
  })

  describe("exits when the cookie domain is not a host name", () => {
    for (const value of [
      "app.example; SameSite=None",
      "https://app.example",
      "app example",
      "app\u0000.example",
      "app_example",
      "app.example\r\nSet-Cookie: a=b",
    ]) {
      it(JSON.stringify(value), () => {
        expect(refused({ COOKIE_DOMAIN: value })).toBe("COOKIE_DOMAIN")
      })
    }
  })

  describe("exits when a mail setting is missing or empty", () => {
    for (const name of ["RESEND_API_KEY", "RESEND_FROM"]) {
      for (const value of [undefined, ""]) {
        it(`${name} ${JSON.stringify(value) ?? "undefined"}`, () => {
          expect(refused({ [name]: value })).toBe(name)
        })
      }
    }

    it("puts no key into the refusal", () => {
      expect(JSON.stringify(readStartSettings({ ...good, RESEND_FROM: undefined }))).not.toContain("resend-secret")
    })
  })

  it("reports the first bad setting in the order the entry checks them", () => {
    expect(refused({ DECK_DATABASE_URL: undefined, PORT: "abc", PUBLIC_ORIGIN: "app" })).toBe("DECK_DATABASE_URL")
    expect(refused({ PORT: "abc", PUBLIC_ORIGIN: "app" })).toBe("PORT")
    expect(refused({ PUBLIC_ORIGIN: "app", SITE_ORIGIN: "app" })).toBe("PUBLIC_ORIGIN")
    expect(refused({ SITE_ORIGIN: "app", MCP_RESOURCE: "app" })).toBe("SITE_ORIGIN")
    expect(refused({ MCP_RESOURCE: "app", COOKIE_DOMAIN: "a b" })).toBe("MCP_RESOURCE")
  })
})
