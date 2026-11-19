import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const pages = ["../pages/sign-in.astro", "../pages/sign-in/check.astro", "../pages/sign-in/expired.astro"]

function source(page: string): string {
  return readFileSync(new URL(page, import.meta.url), "utf8")
}

describe("sign-in pages", () => {
  it.each(pages)("%s sits on the canvas in a 440 px column under a 40 px mark and a 26 px heading", (page) => {
    const text = source(page)
    expect(text).toContain("bg-canvas")
    expect(text).toContain("max-w-[440px]")
    expect(text).toContain("<AirdesignMark size={40} />")
    expect(text).toContain("text-[26px]")
  })

  it("keeps the expired page's copy free of blame and says what to do", () => {
    const text = source("../pages/sign-in/expired.astro")
    expect(text).toContain("Get a new link")
    expect(text).not.toMatch(/oops|sorry|invalid|your fault/i)
  })
})
