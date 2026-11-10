import { describe, expect, it } from "vitest"

import { readStartSettings } from "./start-settings.js"

const good = {
  SESSION_DATABASE_URL: "postgres://session:secret-one@127.0.0.1:5432/api",
  DECK_DATABASE_URL: "postgres://deck:secret-two@127.0.0.1:5432/api",
  LISTEN_DATABASE_URL: "postgres://listen:secret-three@127.0.0.1:5432/api",
  PUBLIC_ORIGIN: "https://app.example",
  SITE_ORIGIN: "https://site.example",
  MCP_RESOURCE: "https://mcp.example/mcp",
}

function refused(values: Record<string, string | undefined>): string | undefined {
  const outcome = readStartSettings({ ...good, ...values })
  return "refusal" in outcome ? outcome.refusal : undefined
}

const notOrigins = [undefined, "", "http://app.example", "https://app.example/path", "https://app.example/", "app"]

describe("readStartSettings", () => {
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
    })
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
    for (const port of ["0", "abc", "70000", "1e4", "0x1F90", " 8080", "8080 ", "-1", "1.5", "65536"]) {
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
    for (const value of [undefined, "", "http://mcp.example/mcp", "not a url"]) {
      it(JSON.stringify(value), () => {
        expect(refused({ MCP_RESOURCE: value })).toBe("MCP_RESOURCE")
      })
    }
  })

  describe("exits when the cookie domain is not a host name", () => {
    for (const value of ["app.example; SameSite=None", "https://app.example", "app example"]) {
      it(JSON.stringify(value), () => {
        expect(refused({ COOKIE_DOMAIN: value })).toBe("COOKIE_DOMAIN")
      })
    }
  })

  it("reports the first bad setting in the order the entry checks them", () => {
    expect(refused({ DECK_DATABASE_URL: undefined, PORT: "abc", PUBLIC_ORIGIN: "app" })).toBe("DECK_DATABASE_URL")
    expect(refused({ PORT: "abc", PUBLIC_ORIGIN: "app" })).toBe("PORT")
    expect(refused({ PUBLIC_ORIGIN: "app", SITE_ORIGIN: "app" })).toBe("PUBLIC_ORIGIN")
    expect(refused({ SITE_ORIGIN: "app", MCP_RESOURCE: "app" })).toBe("SITE_ORIGIN")
    expect(refused({ MCP_RESOURCE: "app", COOKIE_DOMAIN: "a b" })).toBe("MCP_RESOURCE")
  })
})
