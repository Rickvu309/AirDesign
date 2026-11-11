import { describe, expect, it } from "vitest"
import { appDestination, safeNextPath } from "./app-destination"

describe("safeNextPath", () => {
  it("keeps a path with its query", () => {
    expect(safeNextPath("/thin/abc?x=1")).toBe("/thin/abc?x=1")
  })

  it.each(["//evil.example", "https://evil.example", "/\\evil", "", null, undefined])("falls back to the root for %s", (value) => {
    expect(safeNextPath(value)).toBe("/")
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
