import { describe, expect, it } from "vitest"

import { placed } from "./component/testing/linked-instance-fixtures.js"
import { slidesOf } from "./doom-walk.js"
import { doomFromTree, type TreeNode } from "./doom-tree.js"
import { textFromMarkdown } from "./markdown.js"
import { slideFindings } from "./slide-findings.js"
import { defaultTheme } from "./theme.js"
import { spot } from "./testing/doom-fixtures-art.js"
import { chart, codes, findings, text, type Layer } from "./testing/slide-findings-kit.js"

const tableCodes = (slides: readonly (readonly Layer[])[]) => codes(slides).filter((code) => code !== "no-chart")

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
    ["3 mo", "6 mo", "12 wks"],
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
    ).toMatchObject([{ code: "no-source" }, { code: "no-unit" }])
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
    const small = chart("column", spot(620, 200, 200, 100))
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

  describe("empty cards", () => {
    const words = (chars: string): TreeNode => ({
      type: "shape",
      props: { geometry: { kind: "rect" }, sizing: { w: "fill", h: "hug" }, text: textFromMarkdown(chars, "body") },
    })
    const card = (lines: readonly string[], filled: boolean): TreeNode => ({
      type: "frame",
      props: {
        sizing: { w: "fill", h: "fill" },
        fills: filled ? [{ kind: "solid", color: { var: "background2" } }] : [],
        layout: { mode: "column", gap: 16, padding: { t: 38, r: 38, b: 38, l: 38 }, align: "top-left" },
      },
      children: lines.map(words),
    })
    const row = (high: number, cards: readonly (readonly string[])[], filled = true): TreeNode => ({
      type: "frame",
      name: "KPI",
      props: {
        box: spot(160, 280, 1600, high),
        layout: { mode: "row", gap: 32, padding: { t: 0, r: 0, b: 0, l: 0 }, align: "top-left" },
      },
      children: cards.map((lines) => card(lines, filled)),
    })
    const kpis = [
      ["ARR", "$158.4M", "Target $160.0M"],
      ["Gross margin", "79%", "Target 78%"],
    ]

    it("advises shrinking a row whose fullest card stands mostly empty, once for the row", () => {
      const found = findings([[row(460, [...kpis, ["Net revenue retention", "109%"]]), text("Source: Finance pack")]])
      expect(found).toEqual([
        expect.objectContaining({
          code: "empty-card",
          note: "Make the cards, or the row that holds them, only as tall as their words.",
        }),
      ])
    })

    it("leaves a row its fullest card fills, and frames with no fill, clear", () => {
      expect(codes([[row(300, [...kpis, ["Net revenue retention", "109%"]]), text("Source: Finance pack")]])).toEqual(
        [],
      )
      expect(codes([[row(460, kpis, false)]])).toEqual([])
    })
  })

  it("names a numeric chart with no unit and leaves a pie or a chart with a unit clear", () => {
    const source = text("Source: Annual report")
    expect(findings([[chart("column", spot(0, 200, 600, 500), {}), source]])).toMatchObject([
      { code: "no-unit", note: "Name the unit in the chart's unitHeader, prefix or suffix, such as $M or %." },
    ])
    expect(codes([[chart("line"), source]])).toEqual(["no-unit"])
    expect(codes([[chart("line", spot(0, 200, 600, 500), { suffix: "%" }), source]])).toEqual([])
    expect(codes([[chart("column", spot(0, 200, 600, 500), { prefix: "$" }), source]])).toEqual([])
    expect(codes([[chart("pie"), source]])).toEqual([])
  })

  const card = (...lines: readonly string[]): TreeNode => ({
    type: "frame",
    props: {
      fills: [{ kind: "solid", color: { var: "background2" } }],
      layout: { mode: "column", gap: 10, padding: { t: 0, r: 0, b: 0, l: 0 }, align: "top-left" },
    },
    children: lines.map((line) => text(line)),
  })

  it("asks for a source on KPI and card text that carries three numbers", () => {
    const kpis = [card("ARR", "$158.4M", "Target $160.0M"), card("Churn", "24")]
    expect(codes([kpis])).toEqual(["no-source"])
    expect(codes([[card("Activation rose from 41% to 63%", "Annual prepay at 15% off")]])).toEqual(["no-source"])
    expect(codes([[...kpis, text("Source: Finance close pack")]])).toEqual([])
    expect(codes([[text("ARR $158.4M, target $160.0M, churn 2.4%")]])).toEqual([])
  })

  it.each([
    ["Design takes **3.5 mo**", "Pilot takes 2.5 mo", "Rollout takes 1.5 mo"],
    ["Build in 1.5 years", "Review in 3.5 days", "Ship in 2.5 weeks"],
    ["Lead time 3.5 mo", "Onboarding 2.5 wks", "Renewal in 3k days"],
  ])("leaves cards of durations clear, whole or decimal (%s)", (...lines) => {
    expect(codes([[card(...lines)]])).toEqual([])
  })

  it("counts a number with its unit when a space parts them", () => {
    expect(codes([[card("Conversion 20 %", "Margin 3 %", "Churn 5 %")]])).toEqual(["no-source"])
  })

  it("leaves cards of years, quarters, fiscal years and steps clear", () => {
    expect(
      codes([
        [card("Step 1", "Launch in Q1 FY25"), card("Step 2", "Scale in 2026 and 2027"), card("Step 3", "3 teams")],
      ]),
    ).toEqual([])
  })

  const table = (rows: readonly (readonly string[])[]): TreeNode => ({
    type: "frame",
    props: {
      layout: {
        mode: "grid",
        columns: rows[0]!.map(() => ({ fr: 1 })),
        rows: rows.map(() => "hug" as const),
        gap: 0,
        padding: { t: 0, r: 0, b: 0, l: 0 },
      },
    },
    children: rows.flatMap((row, at) =>
      row.map((cell, col) => {
        const made = text(cell)
        return { ...made, props: { ...made.props, cell: { row: at, col } } }
      }),
    ),
  })
  const segments = [
    ["Segment", "Q3 FY25", "Q3 FY26"],
    ["Enterprise", "15.2", "18.6"],
    ["Mid-market", "13.1", "14.9"],
    ["SMB", "7.9", "8.0"],
    ["Services", "1.4", "1.6"],
  ]
  const source = text("Source: Finance close pack")

  it("finds a Total that does not equal its column's sum and names the total cell", () => {
    const found = findings([[table([...segments, ["Total", "37.6", "43.4"]]), source]]).filter(
      ({ code }) => code !== "no-chart",
    )
    expect(found).toMatchObject([
      {
        code: "total-mismatch",
        note: "Make the total equal the sum of the rows above, or add a note that figures may not sum due to rounding.",
      },
    ])
    expect(found[0]!.node).not.toBe(found[0]!.slide)
  })

  it.each([
    ["the sums match", ["Total", "37.6", "43.1"]],
    ["rounding explains the gap", ["Total", "37.6", "43.2"]],
    ["a cell is not a number", ["Total", "37.6", "n/a"]],
  ])("leaves a Total clear when %s", (_, total) => {
    expect(tableCodes([[table([...segments, total]), source]])).toEqual([])
  })

  it("reads currency, thousands, units and parentheses before it adds a column", () => {
    const money = [
      ["Line", "Cost"],
      ["Hosting", "$1,250K"],
      ["Refund", "($250K)"],
      ["Total", "$1,000K"],
    ]
    expect(tableCodes([[table(money), source]])).toEqual([])
    expect(tableCodes([[table([...money.slice(0, 3), ["Total", "$1,500K"]]), source]])).toEqual(["total-mismatch"])
  })

  it("leaves rates, multiples and points unsummed, since growth rows never add up to a total's growth", () => {
    const rates = [
      ["Segment", "YoY", "Multiple", "Margin change"],
      ["Enterprise", "+22%", "1.2x", "+3 pts"],
      ["SMB", "+1%", "0.9x", "-1 pts"],
      ["Total", "+15%", "1.1x", "+1 pts"],
    ]
    expect(tableCodes([[table(rates), source]])).toEqual([])
  })

  it.each(["Margin (%)", "Growth %", "Margin (pp)", "YoY", "CAGR", "Multiple (x)", "x"])(
    "leaves a rate column clear when its header names the rate (%s)",
    (header) => {
      const rates = [
        ["Segment", header],
        ["A", "50"],
        ["B", "30"],
        ["Total", "40"],
      ]
      expect(tableCodes([[table(rates), source]])).toEqual([])
    },
  )

  const rounded = [
    ["Segment", "Revenue ($M)"],
    ["A", "13"],
    ["B", "12"],
    ["Total", "29"],
  ]

  it("still adds a column whose header names an amount", () => {
    expect(tableCodes([[table(rounded), source]])).toEqual(["total-mismatch"])
  })

  it.each(["Figures are rounded to the nearest $1 million.", "Totals may not sum.", "Due to rounding, totals differ"])(
    "leaves a table clear when the slide says figures are rounded (%s)",
    (note) => {
      expect(tableCodes([[table(rounded), source, text(note)]])).toEqual([])
      expect(tableCodes([[table(rounded), source, card("Note", note)]])).toEqual([])
      expect(tableCodes([[table([...rounded.slice(0, 3), [`Total (${note})`, "29"]]), source]])).toEqual([])
    },
  )

  it("leaves a table with a subtotal, mixed units or a rounding note clear", () => {
    const wrong = ["Total", "37.6", "43.4"]
    expect(tableCodes([[table([...segments, ["Subtotal", "37.6", "43.1"], wrong]), source]])).toEqual([])
    expect(tableCodes([[table([...segments.slice(0, 4), ["Services", "1.4", "1.6%"], wrong]), source]])).toEqual([])
    expect(
      tableCodes([[table([...segments, wrong]), text("Source: Finance. Figures may not sum due to rounding")]]),
    ).toEqual([])
  })
})
