import type { Intent } from "../intent-read.js"
import type { NodeId } from "../ids.js"

const title = (slide: NodeId, text: string): Intent => ({
  op: "insert",
  kind: "text",
  parent: slide,
  text,
  textStyle: "title",
  box: { x: 80, y: 60, w: 1760, h: 110 },
})

export function boardDeckIntents(slides: readonly NodeId[]): readonly (readonly Intent[])[] {
  const [one, two, three, four, five] = slides as [NodeId, NodeId, NodeId, NodeId, NodeId]
  return [
    [
      { op: "insert", kind: "text", parent: one, text: "Q3 board update", textStyle: "title" },
      {
        op: "insert",
        kind: "text",
        parent: one,
        text: "Revenue grew while margin held",
        textStyle: "heading",
        color: "text2",
      },
    ],
    [
      title(two, "Results at a glance"),
      {
        op: "insert",
        kind: "frame",
        parent: two,
        name: "Results",
        rows: [
          ["Metric", "Result", "Change"],
          ["Revenue", "$4.2M", "+12% YoY"],
          ["Margin", "31%", "+2 pts"],
          ["Net retention", "118%", "Best in two years"],
        ],
      },
      { op: "insert", kind: "shape", parent: two, name: "Decision", text: "Approve the expansion budget by Friday" },
    ],
    [
      title(three, "Revenue ran ahead of plan"),
      ...["Plan", "Actual"].map((text, i): Intent => ({
        op: "insert",
        kind: "text",
        parent: three,
        text,
        textStyle: "caption",
        color: i === 0 ? "accent2" : "accent1",
        box: { x: 160 + 160 * i, y: 208, w: 140, h: 42 },
      })),
      ...[
        [3.1, 3.3],
        [3.4, 3.7],
        [3.8, 4.2],
        [4.1, 4.6],
      ].flatMap((values, quarter): Intent[] => {
        const x = 180 + quarter * 430
        return [
          ...values.flatMap((value, series): Intent[] => {
            const left = x + series * 136
            const height = Math.round(value * 112)
            const name = `Q${quarter + 1} ${series === 0 ? "Plan" : "Actual"}`
            return [
              {
                op: "insert",
                kind: "shape",
                parent: three,
                name,
                fill: series === 0 ? "accent2" : "accent1",
                box: { x: left, y: 910 - height, w: 120, h: height },
              },
              {
                op: "insert",
                kind: "text",
                parent: three,
                text: String(value),
                textStyle: "caption",
                box: { x: left, y: 862 - height, w: 120, h: 42 },
              },
            ]
          }),
          {
            op: "insert",
            kind: "text",
            parent: three,
            text: `Q${quarter + 1}`,
            textStyle: "caption",
            box: { x, y: 928, w: 256, h: 40 },
          },
        ]
      }),
    ],
    [
      title(four, "Three priorities for next year"),
      ...[
        { text: "Grow\nEnter two markets", icon: "trending-up" },
        { text: "Protect\nRaise retention", icon: "shield" },
        { text: "Build\nShip the platform", icon: "hammer" },
      ].flatMap(({ text, icon }, at): Intent[] => [
        { op: "insert", kind: "icon", parent: four, icon, box: { x: 80 + at * 600, y: 260, w: 80, h: 80 } },
        { op: "insert", kind: "text", parent: four, text, box: { x: 80 + at * 600, y: 372, w: 520, h: 100 } },
      ]),
    ],
    [
      title(five, "Roadmap"),
      {
        op: "insert",
        kind: "frame",
        parent: five,
        name: "Roadmap",
        rows: [
          ["", "Q1", "Q2", "Q3", "Q4"],
          ["Product", "Beta", "Launch", "Scale", "API"],
          ["Sales", "Pilot", "Roll out", "Expand", "Partners"],
          ["Team", "Hire 5", "Hire 8", "Hire 6", "Review"],
        ],
      },
    ],
  ]
}
