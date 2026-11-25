import { describe, expect, it } from "vitest"

import type { TreeNode } from "./doom-tree.js"
import { chart, codes, findings, text } from "./testing/slide-findings-kit.js"

describe("no-chart", () => {
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
    children: rows.flat().map((cell) => text(cell)),
  })
  const source = text("Source: Finance")
  const quarters = table([
    ["Revenue ($M)", "Q1", "Q2", "Q3", "Q4"],
    ["Enterprise", "12.1", "13.4", "15.0", "16.2"],
    ["SMB", "7.9", "8.0", "7.8", "8.1"],
  ])
  const segments = table([
    ["Segment", "Revenue ($M)"],
    ["Enterprise", "18.6"],
    ["Mid-market", "14.9"],
    ["SMB", "8.0"],
    ["Total", "41.5"],
  ])

  it("asks once for a chart of the deck's clearest series while the deck has none", () => {
    expect(findings([[text("Revenue grew every quarter", "title"), quarters, source]])).toMatchObject([
      {
        code: "no-chart",
        note: "The deck has no chart, and this table holds its clearest number series. If the series proves the slide's title, show it as a chart in the table's place: read_deck with a chart id (column, clustered-chart, stacked, waterfall, line, pie) gives its data, then add kind component.",
      },
    ])
    expect(codes([[segments, source]])).toEqual(["no-chart"])
    expect(
      codes([
        [
          table([
            ["Answer", "Share"],
            ["Fast", "36%"],
            ["Neutral", "30%"],
            ["Slow", "34%"],
          ]),
          source,
        ],
      ]),
    ).toEqual(["no-chart"])
    expect(
      codes([
        [
          table([
            ["Year", "Customers"],
            ["2024", "2,914"],
            ["2025", "3,207"],
            ["2026", "3,262"],
          ]),
          source,
        ],
      ]),
    ).toEqual(["no-chart"])
  })

  it("names one candidate across a multi-slide edit and repeats only that one on later reads", () => {
    const deck = [
      [segments, source],
      [segments, quarters, source],
    ]
    expect(findings(deck).filter(({ code }) => code === "no-chart")).toMatchObject([{ slide: 1 }])
    expect(codes(deck, [0])).toEqual([])
    expect(findings(deck, [1])).toMatchObject([{ code: "no-chart", slide: 1 }])
    expect(findings(deck, [1, 0])).toMatchObject([{ code: "no-chart", slide: 1 }])
  })

  it("stays quiet once the deck has a chart", () => {
    expect(
      codes([
        [chart(), source],
        [quarters, source],
      ]),
    ).toEqual([])
    expect(
      codes(
        [
          [quarters, source],
          [chart(), source],
        ],
        1,
      ),
    ).toEqual([])
  })

  it.each([
    [
      "digit-only phone numbers",
      [
        ["Name", "Phone"],
        ["Ana", "5551234567"],
        ["Ben", "5559876543"],
        ["Cy", "5550001111"],
      ],
    ],
    [
      "hyphenated phone numbers",
      [
        ["Name", "Phone"],
        ["Ana", "555-123-4567"],
        ["Ben", "555-987-6543"],
        ["Cy", "555-000-1111"],
      ],
    ],
    [
      "an ID directory",
      [
        ["Account ID", "Owner"],
        ["10442", "Ana"],
        ["10518", "Ben"],
        ["10731", "Cy"],
      ],
    ],
    [
      "IDs with no header",
      [
        ["Ana", "10442"],
        ["Ben", "10518"],
        ["Cy", "10731"],
        ["Di", "10802"],
      ],
    ],
    [
      "a code column",
      [
        ["Office", "Code"],
        ["Hanoi", "084"],
        ["Lyon", "033"],
        ["Austin", "001"],
      ],
    ],
    [
      "a price list",
      [
        ["Plan", "Price per seat"],
        ["Starter", "$12"],
        ["Pro", "$29"],
        ["Enterprise", "$59"],
      ],
    ],
    [
      "a pricing grid",
      [
        ["Pricing", "Monthly", "Annual"],
        ["Starter", "$12", "$120"],
        ["Pro", "$29", "$290"],
        ["Team", "$59", "$590"],
      ],
    ],
    [
      "bare years",
      [
        ["Milestone", "Year"],
        ["Founded", "2019"],
        ["Series A", "2021"],
        ["IPO", "2026"],
      ],
    ],
    [
      "ranks",
      [
        ["Rank", "Customer"],
        ["1", "Halvorsen"],
        ["2", "Tetra"],
        ["3", "Cobalt"],
      ],
    ],
    [
      "mixed units",
      [
        ["KPI", "Q3"],
        ["ARR", "$158.4M"],
        ["NRR", "109%"],
        ["Payback", "2.4x"],
      ],
    ],
    ["values with no labels", [["12%", "$20", "1.2x"]]],
  ])("leaves a lookup table alone: %s", (_, rows) => {
    expect(codes([[table(rows), source]])).toEqual([])
  })

  it("leaves a table alone when most of its numbers are labels", () => {
    expect(
      codes([
        [
          table([
            ["Account ID", "Opened", "Seats"],
            ["10442", "2019", "40"],
            ["10518", "2021", "55"],
            ["10731", "2024", "12"],
          ]),
          source,
        ],
      ]),
    ).toEqual([])
  })

  it.each([
    ["Appendix: revenue detail", "Revenue rose every quarter"],
    ["Reference tables", "Revenue rose every quarter"],
    ["Revenue rose every quarter", "Appendix"],
  ])("leaves appendix and reference slides alone (%s, %s)", (title, marker) => {
    expect(codes([[text(title, "title"), text(marker), quarters, source]])).not.toContain("no-chart")
  })
})
