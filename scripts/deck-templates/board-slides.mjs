const source = ["Source: Company finance, Q3 2026"]

function kpis(scale) {
  const items = [
    ["Revenue", "$48.2M", "Up 18% on Q3 2025"],
    ["Gross margin", "31%", "Flat for a third quarter"],
    ["Net retention", "112%", "Up from 106% in Q2"],
  ]
  return items.flatMap(([label, number, note], at) => {
    const x = 48 + at * 296
    return [
      { kind: "rule", name: "KPI rule", box: [x, 140, 272, 2], color: "accent1" },
      { kind: "text", name: `${label} label`, box: [x, 154, 272, 16], lines: [label], style: scale.label },
      {
        kind: "text",
        name: `${label} value`,
        box: [x, 178, 272, 64],
        lines: [number],
        style: scale.bigNumber,
        anchor: "b",
      },
      { kind: "text", name: `${label} note`, box: [x, 252, 272, 32], lines: [note], style: scale.caption },
    ]
  })
}

export function boardSlides(scale) {
  return [
    {
      layout: "Title Slide",
      text: {
        label: ["Board meeting · November 2026"],
        ctrTitle: ["Q3 2026 business review"],
        subTitle: ["Growth, margin and the plan for Q4"],
        footer: ["Confidential"],
      },
    },
    { layout: "Section Header", text: { label: ["01"], title: ["Where we stand"], footer: source } },
    {
      layout: "Title and Content",
      text: {
        title: ["Revenue grew 18% while gross margin held at 31%"],
        obj: [
          "Enterprise drove two thirds of new revenue",
          { text: "Three deals above $1M closed in September", level: 1 },
          "Mid-market churn fell to 1.4% a month",
          "Hiring stayed 6% under plan, which kept margin flat",
        ],
        footer: source,
      },
    },
    {
      layout: "Two Content",
      text: {
        title: ["Two levers drive the Q4 plan"],
        left: [
          "Expand enterprise",
          { text: "Add two account teams in EMEA", level: 1 },
          { text: "Target $6M new ARR", level: 1 },
        ],
        right: [
          "Lift margin",
          { text: "Move support to the new platform", level: 1 },
          { text: "Save $1.1M a year from Q1", level: 1 },
        ],
        footer: source,
      },
    },
    { layout: "Title Only", text: { title: ["Q3 at a glance"], footer: source }, shapes: kpis(scale) },
    {
      layout: "Closing",
      text: {
        title: ["Decisions for the board"],
        body: ["Approve the EMEA hiring plan", "Approve the support platform move"],
        footer: ["Confidential"],
      },
    },
  ]
}
