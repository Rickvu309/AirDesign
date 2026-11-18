import type { TextValue } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { applyRoute } from "./slide-route.js"

const part = "ppt/slides/slide1.xml"
const first =
  '<a:p><a:pPr algn="l"/><a:r><a:rPr lang="en-US" dirty="0"><a:latin typeface="Arial"/></a:rPr><a:t>Hello world</a:t></a:r><a:r><a:rPr lang="en-US" b="1" kern="1200"/><a:t>bold</a:t></a:r><a:endParaRPr lang="en-US" sz="1800"/></a:p>'
const second = '<a:p><a:r><a:t>no format</a:t></a:r><a:br><a:rPr lang="en-US"/></a:br><a:br/></a:p>'
const slide = (body: string) =>
  `<p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="S"/></p:nvSpPr><p:txBody><a:bodyPr/>${body}</p:txBody></p:sp></p:spTree>`

const original: TextValue = [
  {
    from: 0,
    runs: [
      { from: 0, text: "Hello world" },
      { from: 1, text: "bold" },
    ],
  },
  {
    from: 1,
    runs: [
      { from: 0, text: "no format" },
      { from: 1, text: "\n" },
      { from: 2, text: "\n" },
    ],
  },
]

function written(value: TextValue): string {
  const after = applyRoute(new Map([[part, encodeUtf8(slide(first + second))]]), {
    name: "text",
    part,
    shape: "2",
    value,
  }).get(part)
  if (after === undefined) throw new Error("part")
  return decodeUtf8(after)
}

function withRuns(paragraph: number, runs: TextValue[number]["runs"]): TextValue {
  return original.map((each, index) => (index === paragraph ? { from: each.from, runs } : each))
}

describe("a run's format in the file", () => {
  it("adds b to a run's properties and keeps its other attributes and children", () => {
    const value = withRuns(0, [
      { from: 0, text: "Hello world", bold: true },
      { from: 1, text: "bold" },
    ])
    expect(written(value)).toBe(
      slide(first.replace('<a:rPr lang="en-US" dirty="0">', '<a:rPr lang="en-US" dirty="0" b="1">') + second),
    )
  })

  it("turns an existing b off in place", () => {
    const value = withRuns(0, [
      { from: 0, text: "Hello world" },
      { from: 1, text: "bold", bold: false },
    ])
    expect(written(value)).toBe(slide(first.replace('b="1"', 'b="0"') + second))
  })

  it("writes i and u, and u none to turn an underline off", () => {
    const value = withRuns(0, [
      { from: 0, text: "Hello world", italic: true, underline: true },
      { from: 1, text: "bold", underline: false },
    ])
    expect(written(value)).toBe(
      slide(
        first
          .replace('<a:rPr lang="en-US" dirty="0">', '<a:rPr lang="en-US" dirty="0" i="1" u="sng">')
          .replace('kern="1200"/>', 'kern="1200" u="none"/>') + second,
      ),
    )
  })

  it("splits a run at a range inside it and copies its properties to each part", () => {
    const value = withRuns(0, [
      { from: 0, text: "Hel" },
      { from: 0, text: "lo wo", bold: true },
      { from: 0, text: "rld" },
      { from: 1, text: "bold" },
    ])
    const properties = '<a:rPr lang="en-US" dirty="0"><a:latin typeface="Arial"/></a:rPr>'
    const bolded = '<a:rPr lang="en-US" dirty="0" b="1"><a:latin typeface="Arial"/></a:rPr>'
    const split = `<a:r>${properties}<a:t>Hel</a:t></a:r><a:r>${bolded}<a:t>lo wo</a:t></a:r><a:r>${properties}<a:t>rld</a:t></a:r>`
    expect(written(value)).toBe(slide(first.replace(`<a:r>${properties}<a:t>Hello world</a:t></a:r>`, split) + second))
  })

  it("adds properties to a run and a break that have none", () => {
    const value = withRuns(1, [
      { from: 0, text: "no format", underline: true },
      { from: 1, text: "\n", bold: true },
      { from: 2, text: "\n", bold: true },
    ])
    expect(written(value)).toBe(
      slide(
        first +
          '<a:p><a:r><a:rPr u="sng"/><a:t>no format</a:t></a:r><a:br><a:rPr lang="en-US" b="1"/></a:br><a:br><a:rPr b="1"/></a:br></a:p>',
      ),
    )
  })

  it("formats a new run from the paragraph's end properties", () => {
    const value = withRuns(0, [
      { from: 0, text: "Hello world" },
      { from: 1, text: "bold" },
      { from: -1, text: "!", italic: true },
    ])
    expect(written(value)).toContain('<a:r><a:rPr lang="en-US" sz="1800" i="1"/><a:t>!</a:t></a:r><a:endParaRPr')
  })

  it("writes a split break's format when its paragraph is rebuilt", () => {
    const value = withRuns(1, [
      { from: 0, text: "no " },
      { from: 0, text: "format" },
      { from: 1, text: "\n", italic: true },
      { from: 2, text: "\n" },
    ])
    expect(written(value)).toContain('<a:br><a:rPr lang="en-US" i="1"/></a:br><a:br/>')
  })

  it("leaves the part as it was when no run has a format", () => {
    expect(written(original)).toBe(slide(first + second))
  })

  it("writes a font face as the run's latin typeface, in place of the one it had", () => {
    const value = withRuns(0, [
      { from: 0, text: "Hello world", font: "Georgia" },
      { from: 1, text: "bold", font: "Georgia" },
    ])
    expect(written(value)).toContain(
      '<a:r><a:rPr lang="en-US" dirty="0"><a:latin typeface="Georgia"/></a:rPr><a:t>Hello world</a:t></a:r><a:r><a:rPr lang="en-US" b="1" kern="1200"><a:latin typeface="Georgia"/></a:rPr><a:t>bold</a:t></a:r>',
    )
  })

  it("writes a font face after the run's fill, where the schema puts it, and escapes it", () => {
    const value = withRuns(0, [
      { from: 0, text: "Hello world" },
      { from: 1, text: "bold", font: 'A&"B', color: { scheme: "accent2" } },
    ])
    expect(written(value)).toContain(
      '<a:rPr lang="en-US" b="1" kern="1200"><a:solidFill><a:schemeClr val="accent2"/></a:solidFill><a:latin typeface="A&amp;&quot;B"/></a:rPr>',
    )
  })
})

describe("a paragraph's spacing in the file", () => {
  it("writes line spacing as a percent and space before and after in points, in schema order", () => {
    const value = original.map((each, index) =>
      index === 0 ? { ...each, lineHeight: 150_000, spaceBefore: 600, spaceAfter: 1_200 } : each,
    )
    expect(written(value)).toContain(
      '<a:pPr algn="l"><a:lnSpc><a:spcPct val="150000"/></a:lnSpc><a:spcBef><a:spcPts val="600"/></a:spcBef><a:spcAft><a:spcPts val="1200"/></a:spcAft></a:pPr>',
    )
  })

  it("replaces a spacing the paragraph had and keeps its bullet after it", () => {
    const value: TextValue = original.map((each, index) =>
      index === 1 ? { ...each, spaceBefore: 0, list: "bullets" } : each,
    )
    expect(written(value)).toContain(
      '<a:p><a:pPr><a:spcBef><a:spcPts val="0"/></a:spcBef><a:buChar char="•"/></a:pPr><a:r><a:t>no format</a:t>',
    )
  })
})

it("writes native single strike and letter spacing without changing the other runs", () => {
  const value = withRuns(0, [
    { from: 0, text: "Hello world", strike: true, letterSpacing: -64 },
    { from: 1, text: "bold" },
  ])
  expect(written(value)).toBe(slide(first.replace('dirty="0"', 'dirty="0" strike="sngStrike" spc="-64"') + second))
})

it("writes decimal numbering as the paragraph's one list choice", () => {
  const value = original.map((paragraph) => ({ ...paragraph, list: "numbers" as const }))
  expect(written(value)).toContain('<a:buAutoNum type="arabicPeriod"/>')
})

it("exports a portable face by its native typeface name and changes no other run bytes", () => {
  for (const face of [
    "Lato Thin",
    "Lato ExtraLight",
    "Lato Light",
    "Lato Medium",
    "Lato SemiBold",
    "Lato ExtraBold",
    "Lato Black",
  ]) {
    const value = withRuns(0, [
      { from: 0, text: "Hello world", font: face },
      { from: 1, text: "bold" },
    ])
    expect(written(value)).toBe(slide(first.replace('typeface="Arial"', `typeface="${face}"`) + second))
  }
})

it("keeps native font metadata while changing only the typeface", () => {
  const native = first
    .replace('typeface="Arial"', 'typeface="Arial" panose="020B0604020202020204" pitchFamily="34" charset="0"')
    .replace("</a:rPr>", '<a:hlinkClick r:id="rId8" tooltip="Read more"/></a:rPr>')
  const parts = new Map([[part, encodeUtf8(slide(native + second))]])
  const after = applyRoute(parts, {
    name: "text",
    part,
    shape: "2",
    value: withRuns(0, [
      { from: 0, text: "Hello world", font: "Lato Light" },
      { from: 1, text: "bold" },
    ]),
  }).get(part)
  expect(after === undefined ? "" : decodeUtf8(after)).toBe(
    slide(native.replace('typeface="Arial"', 'typeface="Lato Light"') + second),
  )
})
