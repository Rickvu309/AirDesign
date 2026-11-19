import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { appDestination, safeNextPath, signedInDestination } from "./app-destination"

const hostileValues = [
  "//",
  "/.//",
  "//[",
  "//evil.example",
  "///evil.example",
  "https://evil.example",
  "/\\evil",
  "\\\\evil.example",
  "@evil.example",
  "/\t/evil.example",
  "/\n/evil.example",
  "/\r/evil.example",
  "/\t\\evil.example",
  "",
  null,
  undefined,
]

describe("safeNextPath", () => {
  it("keeps a path with its query", () => {
    expect(safeNextPath("/deck/abc?x=1")).toBe("/deck/abc?x=1")
  })

  it.each(hostileValues)("falls back to the root for %j", (value) => {
    expect(safeNextPath(value)).toBe("/")
  })

  it.each(hostileValues.filter((value): value is string => typeof value === "string"))(
    "keeps %j on the app host and on the site host",
    (value) => {
      expect(new URL(appDestination("https://app.airdesign.app", value), "https://airdesign.app").host).toBe(
        "app.airdesign.app",
      )
      expect(new URL(appDestination("", value), "https://airdesign.app").host).toBe("airdesign.app")
    },
  )

  it.each(["/.//evil.example", "/..//evil.example"])("never returns a protocol-relative path for %s", (value) => {
    expect(safeNextPath(value).startsWith("//")).toBe(false)
    expect(new URL(appDestination("", value), "https://airdesign.app").host).toBe("airdesign.app")
  })
})

describe("appDestination", () => {
  it("joins the app origin and the remembered path", () => {
    expect(appDestination("https://app.airdesign.app", "/deck/abc?x=1")).toBe("https://app.airdesign.app/deck/abc?x=1")
  })

  it("is the path alone when the app origin is unset", () => {
    expect(appDestination("", "/deck/abc?x=1")).toBe("/deck/abc?x=1")
    expect(appDestination(undefined, null)).toBe("/")
  })
})

describe("signedInDestination", () => {
  const account = `airdesign.account=${"a".repeat(32)}`

  it("sends a browser that holds an account key to the app at the remembered path", () => {
    expect(
      signedInDestination(`theme=dark; ${account}`, "https://studio.airdesign.app", "?next=%2Fdeck%2Fabc%3Fx%3D1"),
    ).toBe("https://studio.airdesign.app/deck/abc?x=1")
    expect(signedInDestination(account, "https://studio.airdesign.app", "")).toBe("https://studio.airdesign.app/")
  })

  it("keeps a hostile next path on the app host", () => {
    expect(signedInDestination(account, "https://studio.airdesign.app", "?next=//evil.example")).toBe(
      "https://studio.airdesign.app/",
    )
  })

  it.each(["", "airdesign.account=", "airdesign.account=not-a-key", `other.account=${"a".repeat(32)}`])(
    "keeps the form for the cookie %j",
    (cookie) => {
      expect(signedInDestination(cookie, "https://studio.airdesign.app", "?next=/deck/abc")).toBeNull()
    },
  )

  it.each(["", undefined])(
    "keeps the form when the app origin is %j, so the page never sends itself to itself",
    (origin) => {
      expect(signedInDestination(account, origin, "?next=/sign-in")).toBeNull()
    },
  )
})

describe("the sign-in page", () => {
  it("remembers the next path from its own address", () => {
    const page = readFileSync(new URL("./sign-in/sign-in-form.astro", import.meta.url), "utf8")
    expect(page).toContain("rememberNextFromSearch(location.search)")
  })
})
