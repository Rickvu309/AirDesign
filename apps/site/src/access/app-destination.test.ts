import { describe, expect, it } from "vitest"
import { appDestination, safeNextPath } from "./app-destination"

const hostileValues = [
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
    expect(safeNextPath("/thin/abc?x=1")).toBe("/thin/abc?x=1")
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
    expect(appDestination("https://app.airdesign.app", "/thin/abc?x=1")).toBe("https://app.airdesign.app/thin/abc?x=1")
  })

  it("is the path alone when the app origin is unset", () => {
    expect(appDestination("", "/thin/abc?x=1")).toBe("/thin/abc?x=1")
    expect(appDestination(undefined, null)).toBe("/")
  })
})
