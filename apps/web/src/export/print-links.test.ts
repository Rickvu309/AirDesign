import { expect, it } from "vitest"
import { linkHref, pageAnchor } from "./print-links"

const printed = new Set(["slide-2", "slide-3"])

it("keeps a web or mail address as it is", () => {
  expect(linkHref("https://airdesign.app/pricing", printed)).toBe("https://airdesign.app/pricing")
  expect(linkHref("mailto:board@example.com", printed)).toBe("mailto:board@example.com")
})

it("points a link to another printed slide at that slide's page", () => {
  expect(linkHref("slide-3", printed)).toBe(`#${pageAnchor("slide-3")}`)
})

it("drops a link to a slide the export leaves out", () => {
  expect(linkHref("slide-9", printed)).toBeNull()
})
