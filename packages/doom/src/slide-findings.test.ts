import { describe, expect, it } from "vitest"

import { placed } from "./component/testing/linked-instance-fixtures.js"
import { slidesOf } from "./doom-walk.js"
import { doomFromTree, type TreeNode } from "./doom-tree.js"
import { textFromMarkdown } from "./markdown.js"
import { sampleChart } from "./sample-charts.js"
import { slideFindings } from "./slide-findings.js"
import { defaultTheme } from "./theme.js"
import { measure, spot } from "./testing/doom-fixtures-art.js"

const text = (chars: string, style: "title" | "display" | "body" = "body", width = 1600): TreeNode => ({
  type: "shape",
  props: {
    ...(style === "body" ? {} : { role: "title" }),
    text: textFromMarkdown(chars, style),
    box: spot(0, 0, width, 180),
  },
})

const chart = (kind: "column" | "pie" = "column"): TreeNode => ({
  type: "frame",
  props: { chart: sampleChart(kind), box: spot(0, 200, 600, 500) },
})

function findings(slides: readonly (readonly TreeNode[])[], count = slides.length) {
  const grown = doomFromTree({ theme: defaultTheme, slides: slides.map((children) => ({ children })) })
  return slideFindings(grown.doom, grown.slides.slice(0, count), { measure })
}

const codes = (slides: readonly (readonly TreeNode[])[], count?: number) =>
  findings(slides, count).map((finding) => finding.code)

describe("slide findings", () => {
  it("advises replacing a topic label with a takeaway and preserves an action title", () => {
    expect(findings([[text("Revenue by region", "title")]])).toMatchObject([
      { code: "title-label", note: "State the slide’s takeaway in one sentence." },
    ])
    expect(codes([[text("Revenue rose in every region", "title")]])).toEqual([])
  })

  it("skips cover, agenda and non-English titles", () => {
    expect(
      codes([
        [text("Market overview", "display")],
        [text("Agenda", "title")],
        [text("Section 2: Market overview", "title")],
        [text("Les revenus par région", "title")],
      ]),
    ).toEqual([])
  })

  it("flags a short title when it wraps beyond two measured lines", () => {
    expect(codes([[text("Demand is rising across markets", "title", 140)]])).toEqual(["title-long"])
    expect(codes([[text("Demand is rising across markets", "title")]])).toEqual([])
  })

  it("uses a loose word limit when the title cannot be measured", () => {
    const long = "Demand is rising " + "across many markets ".repeat(8)
    const check = (title: string) => {
      const grown = doomFromTree({ theme: defaultTheme, slides: [{ children: [text(title, "title")] }] })
      return slideFindings(grown.doom, grown.slides).map(({ code }) => code)
    }
    expect(check("Demand is rising " + "across many markets ".repeat(6))).toEqual([])
    expect(check(long)).toEqual(["title-long"])
  })

  it("finds a duplicate outside the touched slides and ignores out-of-scope titles", () => {
    expect(
      codes(
        [
          [text("Demand is rising", "title")],
          [text("  DEMAND is rising. ", "title")],
          [text("Market overview", "title")],
        ],
        1,
      ),
    ).toEqual(["title-duplicate"])
    expect(codes([[text("Demand is rising", "display")], [text("Demand is rising", "title")]])).toEqual([])
  })

  it("asks for a source on charts and grids with at least three data values", () => {
    const grid: TreeNode = {
      type: "frame",
      props: {
        layout: {
          mode: "grid",
          columns: [{ fr: 1 }],
          rows: ["hug", "hug", "hug"],
          gap: 0,
          padding: { t: 0, r: 0, b: 0, l: 0 },
        },
      },
      children: [text("12%"), text("$20"), text("1.2x")],
    }
    expect(codes([[chart()], [grid]])).toEqual(["no-source", "no-source"])
    expect(
      codes([
        [chart(), text("  Sources: Annual report")],
        [grid, text("Source: Survey")],
      ]),
    ).toEqual([])
    expect(codes([[{ ...grid, children: [text("12%"), text("$20"), text("Q1")] }]])).toEqual([])
  })

  it.each([
    ["2025", "2026", "2027"],
    ["Q1", "FY25", "Step 1"],
  ])("leaves a grid of labels clear (%s, %s, %s)", (...labels) => {
    const grid: TreeNode = {
      type: "frame",
      props: {
        layout: {
          mode: "grid",
          columns: [{ fr: 1 }],
          rows: ["hug", "hug", "hug"],
          gap: 0,
          padding: { t: 0, r: 0, b: 0, l: 0 },
        },
      },
      children: labels.map((label) => text(label)),
    }
    expect(codes([[grid]])).toEqual([])
  })

  it.each([
    "Note: Fiscal years\nSource: Annual report",
    "Note: Fiscal years. Sources: Annual reports",
    "Note: Fiscal years Source: Annual report",
  ])("accepts a source label after a note (%s)", (footer) => {
    expect(codes([[chart(), text(footer)]])).toEqual([])
  })

  it("recognizes a linked column chart without counting its generated layers", () => {
    const doom = placed()
    expect(
      slideFindings(
        doom,
        slidesOf(doom).map(({ id }) => id),
      ),
    ).toMatchObject([{ code: "no-source" }])
  })

  it("asks whether two full-size charts make different points", () => {
    expect(findings([[chart(), chart(), text("Source: Annual report")]])).toMatchObject([
      { code: "two-charts", note: "If the charts make different points, give each its own slide." },
    ])
    expect(codes([[chart("pie"), chart(), text("Source: Annual report")]])).toEqual(["two-charts"])
  })

  it("gives one comparison finding for two pies", () => {
    expect(codes([[chart("pie"), chart("pie"), text("Source: Annual report")]])).toEqual(["pie-compare"])
  })

  it("leaves a full-size chart with a small companion clear", () => {
    const small: TreeNode = { ...chart(), props: { chart: sampleChart("column"), box: spot(620, 200, 200, 100) } }
    expect(codes([[small, chart(), text("Source: Annual report")]])).toEqual([])
  })

  it("leaves long agendas clear", () => {
    expect(codes([[text("Agenda", "title"), text("- one\n- two\n- three\n- four\n- five\n- six")]])).toEqual([])
  })

  it("leaves Roman numerals clear", () => {
    expect(codes([[text("XX"), text("Super Bowl XX"), text("XX-Large"), text("XX chromosome")]])).toEqual([])
  })

  it("counts only top-level bullet paragraphs in each block", () => {
    const five = "- one\n- two\n- three\n- four\n- five"
    expect(codes([[text(five + "\n  - nested"), text(five)]])).toEqual([])
    expect(codes([[text(five + "\n- six")]])).toEqual(["many-bullets"])
  })

  it("flags placeholder text, including percent markers, without flagging partial words", () => {
    expect(codes([["Untitled", "TBD", "XX%", "X%", "00.0%", "Lorem ipsum"].map((value) => text(value))])).toEqual(
      Array.from({ length: 6 }, () => "placeholder-text"),
    )
    expect(codes([[text("0.0% and 100.0%"), text("Alorem")]])).toEqual([])
  })
})
