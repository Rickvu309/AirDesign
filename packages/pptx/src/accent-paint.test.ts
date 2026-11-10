import { describe, expect, it } from "vitest"
import { renderedAccent } from "./accent-paint.js"

const theme = (accent: string) => `<a:accent1><a:srgbClr val="${accent}"/></a:accent1>`
const accentShape = `<p:sp><p:spPr><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></p:spPr></p:sp>`

describe("renderedAccent", () => {
  it("paints the theme accent1 value for a shape that uses it", () => {
    expect(renderedAccent(theme("4F81BD"), accentShape)).toBe("4F81BD")
    expect(renderedAccent(theme("FF00FF"), accentShape)).toBe("FF00FF")
  })

  it("paints nothing when the shape does not reference accent1", () => {
    const text = `<p:sp><a:solidFill><a:schemeClr val="dk1"/></a:solidFill></p:sp>`
    expect(renderedAccent(theme("FF00FF"), text)).toBeNull()
    expect(renderedAccent(theme("FF00FF"), `<p:sp><a:srgbClr val="112233"/></p:sp>`)).toBeNull()
  })

  it("does not treat accent10 as accent1", () => {
    const shape = `<a:schemeClr val="accent10"/>`
    expect(renderedAccent(theme("FF00FF"), shape)).toBeNull()
  })

  it("fails when a shape uses accent1 and the theme has no srgb value", () => {
    expect(() => renderedAccent(`<a:accent1><a:sysClr val="windowText"/></a:accent1>`, accentShape)).toThrow(/accent1/)
  })
})
