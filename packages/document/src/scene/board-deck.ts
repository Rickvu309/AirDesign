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
        kind: "kpi",
        slide: two,
        items: [
          { title: "Revenue", value: "$4.2M", note: "+12% YoY" },
          { title: "Margin", value: "31%", note: "+2 pts" },
          { title: "Net retention", value: "118%", note: "Best in two years" },
        ],
      },
      {
        op: "add",
        kind: "cards",
        slide: two,
        name: "Decision",
        items: [{ title: "Decision requested", points: ["Approve the $2M expansion budget", "Vote by Friday"] }],
      },
    ],
    [
      title(three, "Revenue ran ahead of plan"),
      {
        op: "add",
        kind: "chart",
        slide: three,
        chart: {
          kind: "bar",
          categories: ["Q1", "Q2", "Q3", "Q4"],
          series: [
            { name: "Plan", values: [3.1, 3.4, 3.8, 4.1], color: "accent2" },
            { name: "Actual", values: [3.3, 3.7, 4.2, 4.6] },
          ],
          labels: true,
        },
      },
    ],
    [
      title(four, "Three priorities for next year"),
      {
        op: "add",
        kind: "cards",
        slide: four,
        items: [
          { title: "Grow", icon: "trending-up", points: ["Enter two markets", "Double the sales team"] },
          { title: "Protect", icon: "shield", points: ["Cut cost to serve", "Raise retention"] },
          { title: "Build", icon: "hammer", points: ["Ship the platform", "Open the API"] },
        ],
      },
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
