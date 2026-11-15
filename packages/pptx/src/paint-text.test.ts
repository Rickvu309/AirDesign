import { describe, expect, it, vi } from "vitest"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): {
    readFileSync(path: string): Uint8Array
    readdirSync(path: string): readonly string[]
  }
  getBuiltinModule(name: "node:zlib"): { inflateRawSync(data: Uint8Array): Uint8Array }
}

const { readFileSync, readdirSync } = process.getBuiltinModule("node:fs")
const { inflateRawSync } = process.getBuiltinModule("node:zlib")
import { encodeUtf8 } from "./package-bytes.js"
import { readContainer, stored } from "./package-container.js"
import { paintReader, type PaintElement } from "./paint-reader.js"
import type { PaintParagraph, PaintRun, PaintText } from "./paint-text.js"
import { readShapes, readSlides, type ReadShape } from "./read-shapes.js"
import { shownText } from "./text-value-route.js"

const work = vi.hoisted(() => ({ parses: 0 }))

vi.mock("./element-span.js", async (original) => {
  const real = await original<typeof import("./element-span.js")>()
  return {
    ...real,
    markupDocument: (bytes: Uint8Array) => {
      work.parses += 1
      return real.markupDocument(bytes)
    },
  }
})

const slidePart = "ppt/slides/slide1.xml"
const layoutPart = "ppt/slideLayouts/slideLayout1.xml"
const masterPart = "ppt/slideMasters/slideMaster1.xml"
const themePart = "ppt/theme/theme1.xml"

const rels = (type: string, target: string) =>
  `<Relationships><Relationship Id="r1" Type="r/${type}" Target="${target}"/></Relationships>`

const sheet = (root: string, shapes: string, tail = "") =>
  `<${root}><p:cSld><p:spTree>${shapes}</p:spTree></p:cSld>${tail}</${root}>`

const run = (text = "x", format = "") => `<a:r>${format}<a:t>${text}</a:t></a:r>`
const para = (inner = run()) => `<a:p>${inner}</a:p>`
const title = `<p:ph type="title"/>`

type Shape = {
  readonly id?: string
  readonly ph?: string
  readonly style?: string
  readonly body?: string
  readonly list?: string
  readonly text?: string
}

const shape = ({ id = "2", ph = "", style = "", body = "<a:bodyPr/>", list = "", text = para() }: Shape) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="s"/><p:cNvSpPr/><p:nvPr>${ph}</p:nvPr></p:nvSpPr><p:spPr/>${style}<p:txBody>${body}<a:lstStyle>${list}</a:lstStyle>${text}</p:txBody></p:sp>`

const theme = `<a:theme><a:themeElements><a:clrScheme><a:dk1><a:srgbClr val="111111"/></a:dk1><a:lt1><a:srgbClr val="EEEEEE"/></a:lt1><a:accent1><a:srgbClr val="804020"/></a:accent1><a:accent2><a:srgbClr val="00AA00"/></a:accent2></a:clrScheme><a:fontScheme><a:majorFont><a:latin typeface="Major Latin"/><a:ea typeface="Major East"/><a:cs typeface="Major Complex"/></a:majorFont><a:minorFont><a:latin typeface="Minor Latin"/><a:ea typeface="Minor East"/><a:cs typeface=""/></a:minorFont></a:fontScheme></a:themeElements></a:theme>`

const clrMap = `<p:clrMap bg1="lt1" tx1="dk1" accent1="accent1" accent2="accent2"/>`

type Deck = {
  readonly slide?: string
  readonly layout?: string
  readonly master?: string
  readonly styles?: string
  readonly defaults?: string
  readonly slideTail?: string
}

const deck = ({ slide = "", layout = "", master = "", styles = "", defaults = "", slideTail = "" }: Deck) =>
  new Map<string, Uint8Array>(
    (
      [
        [
          "ppt/presentation.xml",
          `<p:presentation><p:defaultTextStyle>${defaults}</p:defaultTextStyle></p:presentation>`,
        ],
        [slidePart, sheet("p:sld", slide, slideTail)],
        ["ppt/slides/_rels/slide1.xml.rels", rels("slideLayout", "../slideLayouts/slideLayout1.xml")],
        [layoutPart, sheet("p:sldLayout", layout)],
        ["ppt/slideLayouts/_rels/slideLayout1.xml.rels", rels("slideMaster", "../slideMasters/slideMaster1.xml")],
        [masterPart, sheet("p:sldMaster", master, `${clrMap}<p:txStyles>${styles}</p:txStyles>`)],
        ["ppt/slideMasters/_rels/slideMaster1.xml.rels", rels("theme", "../theme/theme1.xml")],
        [themePart, theme],
      ] as const
    ).map(([name, text]) => [name, encodeUtf8(text)] as const),
  )

const elementOf = (input: Deck, id = "2"): PaintElement => {
  const found = paintReader(deck(input))
    .slide(slidePart)
    .elements.find((element) => element.shape === id)
  if (found === undefined) throw new Error(`shape ${id}`)
  return found
}
const textOf = (input: Deck, id = "2"): PaintText => {
  const { text } = elementOf(input, id)
  if (text === null) throw new Error(`text ${id}`)
  return text
}
const paragraphOf = (input: Deck, at = 0): PaintParagraph => {
  const paragraph = textOf(input).paragraphs[at]
  if (paragraph === undefined) throw new Error(`paragraph ${at}`)
  return paragraph
}
const runOf = (input: Deck, at = 0): PaintRun => {
  const found = paragraphOf(input).runs[at]
  if (found === undefined) throw new Error(`run ${at}`)
  return found
}

const solid = (hex: string) => `<a:solidFill><a:srgbClr val="${hex}"/></a:solidFill>`
const color = (hex: string) => ({ hex, alpha: 1 })
const level = (n: number, inner: string, attributes = "") => `<a:lvl${n}pPr ${attributes}>${inner}</a:lvl${n}pPr>`
const defaults = (attributes: string, inner = "") => `<a:defRPr ${attributes}>${inner}</a:defRPr>`
const otherStyle = (inner: string) => `<p:otherStyle>${inner}</p:otherStyle>`
const bodyStyle = (inner: string) => `<p:bodyStyle>${inner}</p:bodyStyle>`
const titleStyle = (inner: string) => `<p:titleStyle>${inner}</p:titleStyle>`

const chain = ["run", "paragraph", "own", "layout", "master", "styles"] as const
type Link = (typeof chain)[number]

const chained = (nearest: Link): Deck => {
  const start = chain.findIndex((link) => link === nearest)
  const at = (link: Link): string | null => {
    const place = chain.findIndex((item) => item === link)
    if (place < start) return null
    return `sz="${1000 + place * 100}" b="${place === start ? 1 : 0}"`
  }
  const fill = (link: Link) => solid(`00000${chain.findIndex((item) => item === link)}`)
  const lvl = (link: Link) => {
    const attributes = at(link)
    return attributes === null ? "" : level(1, defaults(attributes, fill(link)))
  }
  const format = at("run")
  const paragraphAttributes = at("paragraph")
  return {
    slide: shape({
      ph: title,
      list: lvl("own"),
      text: para(
        `${paragraphAttributes === null ? "" : `<a:pPr>${defaults(paragraphAttributes, fill("paragraph"))}</a:pPr>`}${run(
          "x",
          format === null ? "" : `<a:rPr ${format}>${fill("run")}</a:rPr>`,
        )}`,
      ),
    }),
    layout: shape({ id: "10", ph: title, list: lvl("layout") }),
    master: shape({ id: "20", ph: title, list: lvl("master") }),
    styles: titleStyle(lvl("styles")),
  }
}

describe("paintText inheritance", () => {
  it.each(chain)("takes size, bold and color from %s, nearest first", (link) => {
    const place = chain.findIndex((item) => item === link)
    const found = runOf(chained(link))
    expect(found.size).toBe((1000 + place * 100) / 100)
    expect(found.bold).toBe(true)
    expect(found.color).toEqual(color(`00000${place}`))
  })

  it("resolves each property on its own", () => {
    const found = runOf({
      slide: shape({ list: level(1, defaults(`sz="1100"`)), text: para(run("x", `<a:rPr b="1"/>`)) }),
      defaults: level(1, defaults(`i="1" sz="9900"`, solid("123456"))),
    })
    expect([found.size, found.bold, found.italic, found.color]).toEqual([11, true, true, color("123456")])
  })

  it("gives the schema values when nothing resolves", () => {
    expect(runOf({ slide: shape({}) })).toEqual({
      from: 0,
      kind: "text",
      text: "x",
      font: "Minor Latin",
      size: 18,
      bold: false,
      italic: false,
      underline: false,
      strike: false,
      baseline: 0,
      color: color("111111"),
      highlight: null,
    })
  })

  it("lets a false nearer value beat a true further one", () => {
    const found = runOf({
      slide: shape({ text: para(run("x", `<a:rPr b="0" u="none" strike="noStrike"/>`)) }),
      defaults: level(1, defaults(`b="1" u="sng" strike="sngStrike"`)),
    })
    expect([found.bold, found.underline, found.strike]).toEqual([false, false, false])
  })

  it("reads underline, strike and baseline as a fraction", () => {
    const found = runOf({
      slide: shape({ text: para(run("x", `<a:rPr u="dbl" strike="dblStrike" baseline="30000"/>`)) }),
    })
    expect([found.underline, found.strike, found.baseline]).toEqual([true, true, 0.3])
  })

  it("uses the paragraph's level, 0-based", () => {
    const list = level(1, defaults(`sz="1000"`)) + level(3, defaults(`sz="3000"`), `marL="777"`)
    const input = { slide: shape({ list, text: para(`<a:pPr lvl="2"/>${run()}`) }) }
    expect(runOf(input).size).toBe(30)
    expect(paragraphOf(input).level).toBe(2)
    expect(paragraphOf(input).marginLeft).toBe(777)
  })

  it("falls back to a:defPPr where the level is missing", () => {
    const list = `<a:defPPr algn="r">${defaults(`sz="4100"`)}</a:defPPr>`
    const input = { slide: shape({ list, text: para(`<a:pPr lvl="4"/>${run()}`) }) }
    expect(runOf(input).size).toBe(41)
    expect(paragraphOf(input).align).toBe("right")
  })

  it("prefers a list's level to its a:defPPr", () => {
    const list = `<a:defPPr>${defaults(`sz="4100"`)}</a:defPPr>${level(1, defaults(`sz="1200"`))}`
    expect(runOf({ slide: shape({ list }) }).size).toBe(12)
  })

  it("matches layout by idx and master by type, as boxes do", () => {
    const input = {
      slide: shape({ ph: `<p:ph idx="7"/>` }),
      layout:
        shape({ id: "10", ph: `<p:ph type="body" idx="3"/>`, list: level(1, defaults(`sz="1300"`)) }) +
        shape({ id: "11", ph: `<p:ph type="subTitle" idx="7"/>`, list: level(1, defaults(`i="1"`)) }),
      master: shape({ id: "20", ph: `<p:ph type="body"/>`, list: level(1, defaults(`b="1"`)) }),
    }
    const found = runOf(input)
    expect([found.size, found.italic, found.bold]).toEqual([18, true, true])
  })

  it("does not take a placeholder list for a shape that is not one", () => {
    const input = {
      slide: shape({}),
      layout: shape({ id: "10", ph: title, list: level(1, defaults(`sz="1300"`)) }),
    }
    expect(runOf(input).size).toBe(18)
  })

  it.each([
    [`<p:ph type="title"/>`, 10],
    [`<p:ph type="ctrTitle"/>`, 10],
    [`<p:ph type="body" idx="1"/>`, 20],
    [`<p:ph type="subTitle" idx="1"/>`, 20],
    [`<p:ph type="obj" idx="1"/>`, 20],
    [`<p:ph idx="1"/>`, 20],
    [`<p:ph type="dt" idx="10"/>`, 30],
    [`<p:ph type="pic" idx="13"/>`, 30],
    ["", 30],
  ])("picks the master's style for %s", (ph, size) => {
    const styles =
      titleStyle(level(1, defaults(`sz="1000"`))) +
      bodyStyle(level(1, defaults(`sz="2000"`))) +
      otherStyle(level(1, defaults(`sz="3000"`)))
    expect(runOf({ slide: shape({ ph }), styles }).size).toBe(size)
  })

  it("picks the style from the layout placeholder's type", () => {
    const styles = titleStyle(level(1, defaults(`sz="1000"`))) + bodyStyle(level(1, defaults(`sz="2000"`)))
    const input = {
      slide: shape({ ph: `<p:ph idx="4"/>` }),
      layout: shape({ id: "10", ph: `<p:ph type="title" idx="4"/>` }),
      styles,
    }
    expect(runOf(input).size).toBe(10)
  })

  it("resolves paragraph properties through the chain", () => {
    const list = level(
      1,
      `<a:lnSpc><a:spcPct val="90000"/></a:lnSpc><a:spcBef><a:spcPts val="600"/></a:spcBef>`,
      `algn="ctr" marL="100" indent="-50"`,
    )
    const input = {
      slide: shape({ text: para(`<a:pPr algn="just"><a:spcAft><a:spcPct val="20000"/></a:spcAft></a:pPr>${run()}`) }),
      defaults: list,
    }
    expect(paragraphOf(input)).toMatchObject({
      align: "justify",
      marginLeft: 100,
      indent: -50,
      lineSpacing: { percent: 0.9 },
      spaceBefore: { points: 6 },
      spaceAfter: { percent: 0.2 },
    })
  })

  it.each([
    ["l", "left"],
    ["ctr", "center"],
    ["r", "right"],
    ["just", "justify"],
    ["dist", "distributed"],
  ])("maps algn %s to %s", (value, align) => {
    expect(paragraphOf({ slide: shape({ text: para(`<a:pPr algn="${value}"/>`) }) }).align).toBe(align)
  })
})

describe("paintText fontRef and fonts", () => {
  const style = (index: string, inner = `<a:schemeClr val="lt1"/>`) =>
    `<p:style><a:fontRef idx="${index}">${inner}</a:fontRef></p:style>`
  const farColor = level(1, defaults("", `${solid("010101")}<a:latin typeface="+mn-ea"/>`))

  it("beats the master styles and presentation defaults", () => {
    const found = runOf({
      slide: shape({ style: style("major") }),
      styles: otherStyle(farColor),
      defaults: farColor,
    })
    expect(found.color).toEqual(color("EEEEEE"))
    expect(found.font).toBe("Major Latin")
  })

  it("selects the minor font", () => {
    expect(runOf({ slide: shape({ style: style("minor") }) }).font).toBe("Minor Latin")
  })

  it("gives no font for idx none, and leaves the chain to answer", () => {
    expect(runOf({ slide: shape({ style: style("none") }), defaults: farColor }).font).toBe("Minor East")
  })

  it("loses to an explicit run value and to a list style", () => {
    const list = level(1, defaults("", `${solid("020202")}<a:latin typeface="Listed"/>`))
    const listed = runOf({ slide: shape({ style: style("major"), list }) })
    expect([listed.color, listed.font]).toEqual([color("020202"), "Listed"])
    const format = `<a:rPr>${solid("030303")}<a:latin typeface="Own"/></a:rPr>`
    const own = runOf({ slide: shape({ style: style("major"), text: para(run("x", format)) }) })
    expect([own.color, own.font]).toEqual([color("030303"), "Own"])
  })

  it("leaves color to the chain when fontRef has none", () => {
    expect(runOf({ slide: shape({ style: style("minor", "") }), defaults: farColor }).color).toEqual(color("010101"))
  })

  it.each([
    ["+mj-lt", "Major Latin"],
    ["+mj-ea", "Major East"],
    ["+mj-cs", "Major Complex"],
    ["+mn-lt", "Minor Latin"],
    ["+mn-ea", "Minor East"],
    ["Plain Face", "Plain Face"],
  ])("resolves the typeface %s", (typeface, font) => {
    const format = `<a:rPr><a:latin typeface="${typeface}"/></a:rPr>`
    expect(runOf({ slide: shape({ text: para(run("x", format)) }) }).font).toBe(font)
  })

  it("reads only the latin typeface", () => {
    const format = `<a:rPr><a:ea typeface="East"/><a:cs typeface="Complex"/></a:rPr>`
    expect(runOf({ slide: shape({ text: para(run("x", format)) }) }).font).toBe("Minor Latin")
  })
})

describe("paintText colors", () => {
  const scheme = (name: string, inner = "") =>
    `<a:solidFill><a:schemeClr val="${name}">${inner}</a:schemeClr></a:solidFill>`

  it("resolves a scheme color through the master's map with its transforms", () => {
    const format = `<a:rPr>${scheme("tx1")}</a:rPr>`
    expect(runOf({ slide: shape({ text: para(run("x", format)) }) }).color).toEqual(color("111111"))
    const half = `<a:rPr>${scheme("accent1", `<a:alpha val="50000"/>`)}</a:rPr>`
    expect(runOf({ slide: shape({ text: para(run("x", half)) }) }).color).toEqual({ hex: "804020", alpha: 0.5 })
  })

  it("uses the slide's color map override", () => {
    const format = `<a:rPr>${scheme("tx1")}</a:rPr>`
    const slideTail = `<p:clrMapOvr><a:overrideClrMapping tx1="accent2"/></p:clrMapOvr>`
    expect(runOf({ slide: shape({ text: para(run("x", format)) }), slideTail }).color).toEqual(color("00AA00"))
  })

  it("lets a:noFill stop the chain with no color", () => {
    const format = `<a:rPr><a:noFill/></a:rPr>`
    const input = { slide: shape({ text: para(run("x", format)) }), defaults: level(1, defaults("", solid("010101"))) }
    expect(runOf(input).color).toBeNull()
  })
})

describe("paintText bodyPr", () => {
  it("gives the schema defaults", () => {
    expect(textOf({ slide: shape({}) })).toMatchObject({
      anchor: "top",
      insets: { left: 91440, top: 45720, right: 91440, bottom: 45720 },
      wrap: true,
      fontScale: 1,
      spacingReduction: 0,
    })
  })

  it("inherits each value on its own, nearest first", () => {
    const text = textOf({
      slide: shape({ ph: title, body: `<a:bodyPr lIns="1"/>` }),
      layout: shape({ id: "10", ph: title, body: `<a:bodyPr lIns="9" tIns="2" anchor="ctr"/>` }),
      master: shape({ id: "20", ph: title, body: `<a:bodyPr tIns="9" rIns="3" anchor="b" wrap="none"/>` }),
    })
    expect(text).toMatchObject({
      anchor: "middle",
      insets: { left: 1, top: 2, right: 3, bottom: 45720 },
      wrap: false,
    })
  })

  it.each([
    ["t", "top"],
    ["ctr", "middle"],
    ["b", "bottom"],
  ])("maps anchor %s to %s", (value, anchor) => {
    expect(textOf({ slide: shape({ body: `<a:bodyPr anchor="${value}"/>` }) }).anchor).toBe(anchor)
  })

  it("lets wrap square beat an inherited none", () => {
    const text = textOf({
      slide: shape({ ph: title, body: `<a:bodyPr wrap="square"/>` }),
      layout: shape({ id: "10", ph: title, body: `<a:bodyPr wrap="none"/>` }),
    })
    expect(text.wrap).toBe(true)
  })

  it("reads normAutofit as fractions", () => {
    const body = `<a:bodyPr><a:normAutofit fontScale="62500" lnSpcReduction="10000"/></a:bodyPr>`
    expect(textOf({ slide: shape({ body }) })).toMatchObject({ fontScale: 0.625, spacingReduction: 0.1 })
  })

  it("gives 1 and 0 for a normAutofit with no values", () => {
    expect(textOf({ slide: shape({ body: `<a:bodyPr><a:normAutofit/></a:bodyPr>` }) })).toMatchObject({
      fontScale: 1,
      spacingReduction: 0,
    })
  })

  it("inherits normAutofit, and noAutofit clears it", () => {
    const fit = `<a:bodyPr><a:normAutofit fontScale="50000"/></a:bodyPr>`
    const layout = shape({ id: "10", ph: title, body: fit })
    expect(textOf({ slide: shape({ ph: title }), layout }).fontScale).toBe(0.5)
    const body = `<a:bodyPr><a:noAutofit/></a:bodyPr>`
    expect(textOf({ slide: shape({ ph: title, body }), layout }).fontScale).toBe(1)
  })
})

describe("paintText bullets", () => {
  const char = `<a:buChar char="•"/>`
  const numbered = (type = "arabicPeriod", start = "") => `<a:buAutoNum type="${type}"${start}/>`
  const item = (props: string, attributes = "") => para(`<a:pPr ${attributes}>${props}</a:pPr>${run()}`)
  const numbers = (text: string) =>
    textOf({ slide: shape({ text }) }).paragraphs.map((paragraph) =>
      paragraph.bullet !== null && "number" in paragraph.bullet ? paragraph.bullet.number : null,
    )

  it("has no bullet when nothing resolves", () => {
    expect(paragraphOf({ slide: shape({}) }).bullet).toBeNull()
  })

  it("inherits a character, font, color and size by level", () => {
    const list = level(
      2,
      `<a:buClr><a:srgbClr val="AA0000"/></a:buClr><a:buSzPct val="80000"/><a:buFont typeface="+mj-lt"/>${char}`,
    )
    const input = { slide: shape({ text: para(`<a:pPr lvl="1"/>${run()}`) }), defaults: list }
    expect(paragraphOf(input).bullet).toEqual({ char: "•", font: "Major Latin", color: color("AA0000"), size: 0.8 })
  })

  it("resolves each bullet part on its own", () => {
    const input = {
      slide: shape({ text: item(`<a:buFont typeface="Near"/><a:buChar char="-"/>`) }),
      defaults: level(1, `<a:buClr><a:srgbClr val="AA0000"/></a:buClr><a:buFont typeface="Far"/>${char}`),
    }
    expect(paragraphOf(input).bullet).toEqual({ char: "-", font: "Near", color: color("AA0000"), size: null })
  })

  it("lets a:buNone clear an inherited bullet", () => {
    const input = { slide: shape({ text: item("<a:buNone/>") }), defaults: level(1, char) }
    expect(paragraphOf(input).bullet).toBeNull()
  })

  it("lets a list's a:buNone clear a further list's bullet", () => {
    const input = { slide: shape({ list: level(1, "<a:buNone/>") }), defaults: level(1, char) }
    expect(paragraphOf(input).bullet).toBeNull()
  })

  it("lets a text-following font, color and size clear an inherited one", () => {
    const input = {
      slide: shape({ text: item("<a:buClrTx/><a:buSzTx/><a:buFontTx/>") }),
      defaults: level(
        1,
        `<a:buClr><a:srgbClr val="AA0000"/></a:buClr><a:buSzPct val="80000"/><a:buFont typeface="F"/>${char}`,
      ),
    }
    expect(paragraphOf(input).bullet).toEqual({ char: "•", font: null, color: null, size: null })
  })

  it("gives no size for a:buSzPts", () => {
    const input = { slide: shape({ text: item(`<a:buSzPts val="1200"/>${char}`) }) }
    expect(paragraphOf(input).bullet).toMatchObject({ size: null })
  })

  it("counts same-level paragraphs and reports the scheme", () => {
    const text = item(numbered()) + item(numbered())
    const input = { slide: shape({ text }) }
    expect(paragraphOf(input, 1).bullet).toEqual({
      autoNumber: "arabicPeriod",
      start: 1,
      number: 2,
      font: null,
      color: null,
      size: null,
    })
  })

  it("starts at startAt", () => {
    expect(
      numbers(item(numbered("arabicPeriod", ` startAt="5"`)) + item(numbered("arabicPeriod", ` startAt="5"`))),
    ).toEqual([5, 6])
  })

  it("counts an inherited auto number", () => {
    const input = { slide: shape({ text: para() + para() }), defaults: level(1, numbered()) }
    expect(paragraphOf(input, 1).bullet).toMatchObject({ number: 2 })
  })

  it("keeps counting past a deeper paragraph", () => {
    const deep = item(numbered("alphaLcPeriod"), `lvl="1"`)
    expect(numbers(item(numbered()) + deep + deep + item(numbered()))).toEqual([1, 1, 2, 2])
  })

  it("restarts a deeper level after a shallower paragraph", () => {
    const deep = item(numbered("alphaLcPeriod"), `lvl="1"`)
    expect(numbers(item(numbered()) + deep + item(numbered()) + deep)).toEqual([1, 1, 2, 1])
  })

  it("restarts after an unnumbered paragraph at the same level", () => {
    expect(numbers(item(numbered()) + item("<a:buNone/>") + item(numbered()))).toEqual([1, null, 1])
    expect(numbers(item(numbered()) + item(char) + item(numbered()))).toEqual([1, null, 1])
  })

  it("restarts when the scheme or start changes", () => {
    expect(numbers(item(numbered()) + item(numbered("romanUcPeriod")))).toEqual([1, 1])
    expect(numbers(item(numbered()) + item(numbered("arabicPeriod", ` startAt="3"`)))).toEqual([1, 3])
  })

  it("counts each shape on its own", () => {
    const text = item(numbered())
    const elements = paintReader(deck({ slide: shape({ id: "2", text }) + shape({ id: "3", text }) })).slide(
      slidePart,
    ).elements
    expect(elements.map((element) => element.text?.paragraphs[0]?.bullet)).toMatchObject([{ number: 1 }, { number: 1 }])
  })
})

describe("paintText runs", () => {
  const field = (text: string, format = "") => `<a:fld id="{1}" type="slidenum">${format}<a:t>${text}</a:t></a:fld>`

  it("reads a field with its cached text and own format", () => {
    expect(runOf({ slide: shape({ text: para(field("12", `<a:rPr sz="900"/>`)) }) })).toMatchObject({
      kind: "field",
      text: "12",
      size: 9,
    })
  })

  it("reads a break as a line feed with its own format", () => {
    expect(runOf({ slide: shape({ text: para(`<a:br><a:rPr sz="700"/></a:br>`) }) })).toMatchObject({
      kind: "break",
      text: "\n",
      size: 7,
    })
  })

  it("numbers runs and paragraphs by position, counting fields and breaks", () => {
    const text = para(`${run("a")}<a:br/>${field("2")}${run("b")}`) + para("") + para(run("c"))
    const found = textOf({ slide: shape({ text }) })
    expect(found.paragraphs.map((paragraph) => paragraph.from)).toEqual([0, 1, 2])
    expect(found.paragraphs[0]?.runs.map((item) => [item.from, item.kind, item.text])).toEqual([
      [0, "text", "a"],
      [1, "break", "\n"],
      [2, "field", "2"],
      [3, "text", "b"],
    ])
    expect(found.paragraphs[2]?.runs.map((item) => item.from)).toEqual([0])
  })

  it("decodes entities and skips the paragraph's non-text children", () => {
    const text = para(`<a:pPr/>${run("a &amp; b")}<a:endParaRPr sz="900"/>`)
    const found = textOf({ slide: shape({ text }) })
    expect(found.paragraphs[0]?.runs.map((item) => item.text)).toEqual(["a & b"])
  })
})

describe("paintText endStyle", () => {
  const list = level(1, defaults(`sz="2400" b="1"`, `${solid("123123")}<a:latin typeface="+mj-lt"/>`))

  it("keeps an empty paragraph with no runs, sized by a:endParaRPr", () => {
    const found = paragraphOf({ slide: shape({ text: para(`<a:endParaRPr sz="3200"/>`) }) })
    expect(found.runs).toEqual([])
    expect(found.endStyle.size).toBe(32)
  })

  it("gives an empty box the schema values", () => {
    expect(paragraphOf({ slide: shape({ text: para("") }) }).endStyle).toEqual({
      font: "Minor Latin",
      size: 18,
      bold: false,
      italic: false,
      underline: false,
      strike: false,
      baseline: 0,
      color: color("111111"),
      highlight: null,
    })
  })

  it("resolves a placeholder with no runs through its chain", () => {
    const input = {
      slide: shape({ ph: title, text: para("") }),
      layout: shape({ id: "10", ph: title, list }),
    }
    expect(paragraphOf(input).endStyle).toMatchObject({
      font: "Major Latin",
      size: 24,
      bold: true,
      color: color("123123"),
    })
  })

  it("lets a:endParaRPr override the list style, property by property", () => {
    const end = `<a:endParaRPr sz="1000" i="1" u="sng" strike="sngStrike" baseline="-25000">${solid("ABABAB")}<a:latin typeface="Ends"/></a:endParaRPr>`
    expect(paragraphOf({ slide: shape({ list, text: para(end) }) }).endStyle).toEqual({
      font: "Ends",
      size: 10,
      bold: true,
      italic: true,
      underline: true,
      strike: true,
      baseline: -0.25,
      color: color("ABABAB"),
      highlight: null,
    })
  })

  it("uses the paragraph's level", () => {
    const deeper = level(1, defaults(`sz="1000"`)) + level(2, defaults(`sz="2000"`))
    const input = { slide: shape({ list: deeper, text: para(`<a:pPr lvl="1"/>`) }) }
    expect(paragraphOf(input).endStyle.size).toBe(20)
  })

  it("takes fontRef like a run does", () => {
    const style = `<p:style><a:fontRef idx="minor"><a:schemeClr val="lt1"/></a:fontRef></p:style>`
    expect(paragraphOf({ slide: shape({ style, text: para("") }) }).endStyle).toMatchObject({
      font: "Minor Latin",
      color: color("EEEEEE"),
    })
  })

  it("does not take a run's format", () => {
    const text = para(run("x", `<a:rPr sz="900"/>`))
    expect(paragraphOf({ slide: shape({ text }) }).endStyle.size).toBe(18)
  })
})

describe("paintText on shapes", () => {
  const empty = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="s"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/></p:sp>`

  it("is null with no body", () => {
    expect(elementOf({ slide: empty }).text).toBeNull()
  })

  it("is null with a self-closed body or no paragraphs", () => {
    expect(elementOf({ slide: empty.replace("<p:spPr/>", "<p:spPr/><p:txBody/>") }).text).toBeNull()
    expect(elementOf({ slide: shape({ text: "" }) }).text).toBeNull()
  })

  it("is null on a table's frame", () => {
    const frame = `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="2" name="t"/></p:nvGraphicFramePr><p:xfrm/><a:graphic><a:graphicData><a:tbl><a:tr><a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:t>cell</a:t></a:r></a:p></a:txBody></a:tc></a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame>`
    expect(elementOf({ slide: frame }).text).toBeNull()
  })

  it("reads only the Choice branch", () => {
    const slide = `<mc:AlternateContent><mc:Choice>${shape({ text: para(run("chosen")) })}</mc:Choice><mc:Fallback>${shape({ text: para(run("other")) })}</mc:Fallback></mc:AlternateContent>`
    expect(runOf({ slide }).text).toBe("chosen")
  })

  it("gives layout and master shapes their own text through other style", () => {
    const styles = otherStyle(level(1, defaults(`sz="1500"`)))
    const elements = paintReader(
      deck({
        layout: shape({ id: "10", text: para(run("l")) }),
        master: shape({ id: "20", text: para(run("m")) }),
        styles,
      }),
    ).slide(slidePart).elements
    expect(elements.map((element) => [element.shape, element.text?.paragraphs[0]?.runs[0]?.text])).toEqual([
      ["20", "m"],
      ["10", "l"],
    ])
    expect(elements.map((element) => element.text?.paragraphs[0]?.runs[0]?.size)).toEqual([15, 15])
  })

  it("colors a layout shape with the slide's map, per slide", () => {
    const format = `<a:rPr><a:solidFill><a:schemeClr val="tx1"/></a:solidFill></a:rPr>`
    const parts = deck({ layout: shape({ id: "10", text: para(run("x", format)) }) })
    parts.set(
      "ppt/slides/slide2.xml",
      encodeUtf8(sheet("p:sld", "", `<p:clrMapOvr><a:overrideClrMapping tx1="accent2"/></p:clrMapOvr>`)),
    )
    parts.set("ppt/slides/_rels/slide2.xml.rels", encodeUtf8(rels("slideLayout", "../slideLayouts/slideLayout1.xml")))
    const reader = paintReader(parts)
    const colorOn = (part: string) => reader.slide(part).elements[0]?.text?.paragraphs[0]?.runs[0]?.color
    expect(colorOn(slidePart)).toEqual(color("111111"))
    expect(colorOn("ppt/slides/slide2.xml")).toEqual(color("00AA00"))
    expect(colorOn(slidePart)).toEqual(color("111111"))
  })

  it("survives malformed values and a deck with no theme or presentation", () => {
    const format = `<a:rPr sz="big" b="maybe" baseline="x"><a:solidFill><a:schemeClr val="nope"/></a:solidFill><a:latin/></a:rPr>`
    const body = `<a:bodyPr lIns="wide" anchor="sideways" wrap="?"><a:normAutofit fontScale="many"/></a:bodyPr>`
    const text = para(
      `<a:pPr lvl="99" marL="x" algn="?"><a:lnSpc/><a:buChar/><a:buAutoNum/></a:pPr>${run("x", format)}`,
    )
    const parts = deck({ slide: shape({ body, text }) })
    parts.delete(themePart)
    parts.delete("ppt/presentation.xml")
    const found = paintReader(parts).slide(slidePart).elements[0]?.text
    expect(found?.paragraphs[0]).toMatchObject({
      level: 0,
      marginLeft: 0,
      align: "left",
      lineSpacing: null,
      bullet: null,
    })
    expect(found?.paragraphs[0]?.runs[0]).toMatchObject({ size: 18, bold: false, baseline: 0, color: null, font: null })
    expect(found).toMatchObject({ anchor: "top", wrap: true, fontScale: 1 })
    expect(found?.insets.left).toBe(91440)
  })

  it("parses the theme once across color maps", () => {
    const parts = deck({ slide: shape({}) })
    parts.set(
      "ppt/slides/slide2.xml",
      encodeUtf8(sheet("p:sld", shape({}), `<p:clrMapOvr><a:overrideClrMapping tx1="accent2"/></p:clrMapOvr>`)),
    )
    parts.set("ppt/slides/_rels/slide2.xml.rels", encodeUtf8(rels("slideLayout", "../slideLayouts/slideLayout1.xml")))
    const reader = paintReader(parts)
    reader.slide(slidePart)
    work.parses = 0
    reader.slide("ppt/slides/slide2.xml")
    expect(work.parses).toBe(2)
  })

  it("parses the presentation and theme once across slides", () => {
    const parts = deck({ slide: shape({}) })
    parts.set("ppt/slides/slide2.xml", encodeUtf8(sheet("p:sld", shape({}))))
    parts.set("ppt/slides/_rels/slide2.xml.rels", encodeUtf8(rels("slideLayout", "../slideLayouts/slideLayout1.xml")))
    work.parses = 0
    const reader = paintReader(parts)
    expect(work.parses).toBe(0)
    reader.slide(slidePart)
    expect(work.parses).toBe(8)
    work.parses = 0
    reader.slide("ppt/slides/slide2.xml")
    expect(work.parses).toBe(2)
    work.parses = 0
    reader.slide(slidePart)
    expect(work.parses).toBe(1)
  })
})

const fixtures = `${process.cwd()}/scripts/pptx-fixtures`
const decks = [
  ...readdirSync(fixtures).map((name) => `${fixtures}/${name}`),
  ...readdirSync(`${fixtures}/corpus`).map((name) => `${fixtures}/corpus/${name}`),
].filter((path) => path.endsWith(".pptx"))

const textParts =
  /^ppt\/(presentation\.xml|_rels\/presentation\.xml\.rels|(slides|slideLayouts|slideMasters|theme)\/(_rels\/)?[^/]+)$/

const markupParts = (path: string): ReadonlyMap<string, Uint8Array> =>
  new Map(
    readContainer(new Uint8Array(readFileSync(path)))
      .filter((record) => textParts.test(record.name))
      .map((record) => [record.name, record.method === stored ? record.stream : inflateRawSync(record.stream)]),
  )

const joined = (text: PaintText | null, row: ReadShape): boolean => {
  if (text === null) return row.text.length === 0
  if (text.paragraphs.length !== row.text.length) return false
  return text.paragraphs.every((paragraph) => {
    const source = row.text[paragraph.from]
    if (source === undefined || source.from !== paragraph.from) return false
    if (source.runs.length !== paragraph.runs.length) return false
    return paragraph.runs.every((item) => {
      const origin = source.runs[item.from]
      if (origin === undefined || origin.from !== item.from || origin.text !== item.text) return false
      return item.kind !== "break" || origin.text === "\n"
    })
  })
}

const shown = (text: PaintText | null): string =>
  (text?.paragraphs ?? [])
    .flatMap((paragraph) => paragraph.runs.map((item) => (item.text === "\n" ? "" : item.text)))
    .join("")

describe("paintText on the real decks", () => {
  it("joins every paragraph and run to its TextValue, fields and breaks included", () => {
    const drift: string[] = []
    const seen = { joined: 0, runs: 0, fields: 0, breaks: 0, empty: 0 }
    for (const path of decks) {
      const parts = markupParts(path)
      const reader = paintReader(parts)
      const rows = new Map<string, ReadShape[]>()
      for (const row of readShapes(parts)) {
        const key = `${row.part}#${row.shape}`
        rows.set(key, [...(rows.get(key) ?? []), row])
      }
      for (const { part } of readSlides(parts)) {
        for (const element of reader.slide(part).elements) {
          if (element.from !== "slide") continue
          const key = `${element.part}#${element.shape}`
          const candidates = rows.get(key) ?? []
          const at = candidates.findIndex(
            (row) => joined(element.text, row) && shown(element.text) === shownText(row.text),
          )
          if (at < 0) {
            drift.push(`${path} ${key}`)
            continue
          }
          candidates.splice(at, 1)
          seen.joined += 1
          for (const paragraph of element.text?.paragraphs ?? []) {
            if (paragraph.runs.length === 0) seen.empty += 1
            for (const item of paragraph.runs) {
              seen.runs += 1
              if (item.kind === "field") seen.fields += 1
              if (item.kind === "break") seen.breaks += 1
            }
          }
        }
      }
    }
    expect(drift).toEqual([])
    expect(seen.joined).toBeGreaterThan(0)
    expect(seen.runs).toBeGreaterThan(0)
    expect(seen.fields).toBeGreaterThan(0)
    expect(seen.breaks).toBeGreaterThan(0)
    expect(seen.empty).toBeGreaterThan(0)
  }, 30_000)
})
