import type { AgentChange } from "./agent-change.js"
import type { NodeId } from "./ids.js"

const title = (slide: NodeId, text: string): AgentChange => ({
  op: "add",
  kind: "text",
  slide,
  text,
  textStyle: "title",
  box: { x: 80, y: 60, w: 1760, h: 110 },
})

export function boardDeckChanges(slides: readonly NodeId[]): readonly (readonly AgentChange[])[] {
  const [one, two, three, four, five] = slides as [NodeId, NodeId, NodeId, NodeId, NodeId]
  return [
    [
      { op: "add", kind: "text", slide: one, text: "Q3 board update", textStyle: "title" },
      {
        op: "add",
        kind: "text",
        slide: one,
        text: "Revenue grew while margin held",
        textStyle: "heading",
        color: "text2",
      },
    ],
    [
      title(two, "Results at a glance"),
      {
        op: "add",
        kind: "frame",
        slide: two,
        name: "Results",
        rows: [
          ["Metric", "Result", "Change"],
          ["Revenue", "$4.2M", "+12% YoY"],
          ["Margin", "31%", "+2 pts"],
          ["Net retention", "118%", "Best in two years"],
        ],
      },
      { op: "add", kind: "shape", slide: two, name: "Decision", text: "Approve the expansion budget by Friday" },
    ],
    [
      title(three, "Revenue ran ahead of plan"),
      {
        op: "add",
        kind: "component",
        component: "clustered-chart",
        variant: { orientation: "column" },
        slide: three,
        data: {
          categories: ["Q1", "Q2", "Q3", "Q4"].map((label) => ({ id: label.toLowerCase(), label })),
          series: [
            { id: "plan", label: "Plan", values: [3.1, 3.4, 3.8, 4.1], fill: "accent2" },
            { id: "actual", label: "Actual", values: [3.3, 3.7, 4.2, 4.6] },
          ],
        },
      },
    ],
    [
      title(four, "Three priorities for next year"),
      ...[
        { text: "Grow\nEnter two markets", icon: "trending-up" },
        { text: "Protect\nRaise retention", icon: "shield" },
        { text: "Build\nShip the platform", icon: "hammer" },
      ].flatMap(({ text, icon }, at): AgentChange[] => [
        { op: "add", kind: "icon", slide: four, icon, box: { x: 80 + at * 600, y: 260, w: 80, h: 80 } },
        { op: "add", kind: "text", slide: four, text, box: { x: 80 + at * 600, y: 372, w: 520, h: 100 } },
      ]),
    ],
    [
      title(five, "Roadmap"),
      {
        op: "add",
        kind: "frame",
        slide: five,
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
