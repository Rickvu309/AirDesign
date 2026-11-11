import { describe, expect, it } from "vitest"
import { markupDocument } from "./element-span.js"
import { encodeUtf8 } from "./package-bytes.js"
import { paintColor } from "./paint-color.js"
import { markupChildren } from "./text-value-route.js"

const color = (xml: string) => {
  const { elements } = markupDocument(encodeUtf8(xml))
  return paintColor(elements[0]!, markupChildren(elements), {
    children: [],
    slots: new Map(),
    mapping: new Map(),
    placeholder: null,
  })
}

describe("paint colors", () => {
  it("sends a theme slot name through the color map before the theme", () => {
    const { elements } = markupDocument(
      encodeUtf8(
        '<x><a:schemeClr val="accent1"/><a:accent1><a:srgbClr val="111111"/></a:accent1><a:accent2><a:srgbClr val="222222"/></a:accent2></x>',
      ),
    )
    const slot = (kind: string) => elements.find((element) => element.kind === kind)!
    const children = markupChildren(elements)
    const palette = {
      children,
      slots: new Map([
        ["accent1", slot("a:accent1")],
        ["accent2", slot("a:accent2")],
      ]),
      mapping: new Map([["accent1", "accent2"]]),
      placeholder: null,
    }
    expect(paintColor(slot("a:schemeClr"), children, palette)).toEqual({ hex: "222222", alpha: 1 })
  })

  it.each([
    ['<a:srgbClr val="abcdef"/>', "ABCDEF"],
    ['<a:sysClr val="window" lastClr="123456"/>', "123456"],
    ['<a:prstClr val="dkBlue"/>', "00008B"],
    ['<a:prstClr val="tomato"/>', "FF6347"],
    ['<a:scrgbClr r="100000" g="0" b="50000"/>', "FF00BC"],
    ['<a:hslClr hue="7200000" sat="100000" lum="50000"/>', "00FF00"],
    ['<a:hslClr hue="21600000" sat="0" lum="50000"/>', "808080"],
  ])("resolves %s", (xml, hex) => expect(color(xml)).toEqual({ hex, alpha: 1 }))

  it.each(
    [
      ["lumMod", "50000", "FF0000", "800000"],
      ["lumOff", "25000", "FF0000", "FF8080"],
      ["tint", "25000", "336699", "E1E4EA"],
      ["shade", "25000", "336699", "1B3753"],
      ["satMod", "50000", "FF0000", "BF4040"],
      ["satOff", "-50000", "FF0000", "BF4040"],
      ["hueMod", "200000", "00FF00", "0000FF"],
      ["hueOff", "7200000", "FF0000", "00FF00"],
      ["comp", null, "FF0000", "00FFFF"],
      ["inv", null, "FF8000", "007FFF"],
      ["gray", null, "FF0000", "383838"],
      ["gamma", null, "808080", "BCBCBC"],
      ["invGamma", null, "808080", "373737"],
    ].map(([name, value, input, hex]) => ({
      name,
      value,
      input,
      hex,
      title:
        name === "tint" || name === "shade"
          ? `${name} follows LibreOffice's linear-light model, not checked against PowerPoint`
          : `applies ${name} with hand-checked arithmetic`,
    })),
  )("$title", ({ name, value, input, hex }) => {
    expect(
      color(`<a:srgbClr val="${input}"><a:${name}${value === null ? "" : ` val="${value}"`}/></a:srgbClr>`),
    ).toEqual({ hex, alpha: 1 })
  })

  it.each([
    ['<a:alpha val="40000"/>', 0.4],
    ['<a:alphaMod val="40000"/>', 0.4],
    ['<a:alphaOff val="-40000"/>', 0.6],
    ['<a:alpha val="40000"/><a:alphaMod val="50000"/><a:alphaOff val="10000"/>', 0.3],
  ])("applies alpha in order %s", (transforms, alpha) => {
    expect(color(`<a:srgbClr val="123456">${transforms}</a:srgbClr>`)?.alpha).toBeCloseTo(alpha)
  })

  it("keeps transform order and clamps each operation", () => {
    expect(color('<a:srgbClr val="FF0000"><a:lumMod val="50000"/><a:lumOff val="25000"/></a:srgbClr>')?.hex).toBe(
      "FF0000",
    )
    expect(color('<a:srgbClr val="FF0000"><a:lumOff val="25000"/><a:lumMod val="50000"/></a:srgbClr>')?.hex).toBe(
      "BF0000",
    )
    expect(
      color('<a:srgbClr val="FF0000"><a:alphaOff val="100000"/><a:alphaMod val="50000"/></a:srgbClr>')?.alpha,
    ).toBe(0.5)
  })

  it.each([
    '<a:srgbClr val="wat"/>',
    '<a:sysClr val="window"/>',
    '<a:prstClr val="unknown"/>',
    '<a:scrgbClr r="1" g="2"/>',
    '<a:hslClr hue="0" sat="no" lum="1"/>',
    '<a:schemeClr val="accent1"/>',
    '<a:schemeClr val="phClr"/>',
    "<a:unknown/>",
    '<a:srgbClr val="123456"><a:lumMod val="bad"/></a:srgbClr>',
  ])("omits unknown or incomplete color %s", (xml) => expect(color(xml)).toBeNull())
})
