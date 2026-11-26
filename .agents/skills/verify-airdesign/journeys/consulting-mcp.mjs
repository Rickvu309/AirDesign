export default async function drive({ signIn, post, mcpRoutes, expect, note }) {
  const { cookie } = await signIn()
  let id = 0
  const send = async (method, params) => {
    const response = await post(mcpRoutes.mcp, { jsonrpc: "2.0", id: ++id, method, params }, cookie, {
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": "2025-11-25",
    })
    expect(response.status).toBe(200)
    const message = response.json.events?.[0] ?? response.json
    return typeof message === "string" ? JSON.parse(message) : message
  }
  const call = async (name, args) => {
    const response = await send("tools/call", { name: "airdesign_" + name, arguments: args })
    const answer = response.result?.structuredContent
    expect(answer, JSON.stringify(response)).toMatchObject({ ok: true })
    return answer
  }
  const {
    deck,
    rev,
    slides: [cover],
  } = await call("create_deck", { name: "Regional revenue" })
  const add = await call("edit_deck", {
    deck,
    base: rev,
    changes: [...Array.from({ length: 5 }, () => ({ op: "slide", add: {} })), { op: "slide", delete: cover }],
  })
  const { slides } = await call("read_deck", { deck })
  expect(slides).toHaveLength(5)
  const labels = ["Revenue by region", "Market overview", "Q3 results", "Profit by year", "Volume by segment"]
  const conclusions = [
    "Rework pricing strategy",
    "Approve phase 2 budget",
    "Adopt new operating model",
    "Profit grew across all regions",
    "Retiree Health Benefit funding requirements are a significant burden, equal to 12% of total revenue in 2010",
  ]
  const changes = slides.flatMap((slide, index) => [
    {
      op: "add",
      kind: "text",
      slide,
      textStyle: "title",
      text: labels[index],
      box: { x: 160, y: 80, w: 1600, h: 120 },
    },
    ...[14, 10].map((value, bar) => ({
      op: "add",
      kind: "shape",
      slide,
      name: bar === 0 ? "North" : "South",
      fill: bar === 0 ? "accent1" : "accent2",
      box: { x: 160 + bar * 260, y: 800 - value * 30, w: 200, h: value * 30 },
    })),
  ])
  changes.push({
    op: "add",
    kind: "shape",
    slide: slides[0],
    box: { x: 1850, y: 900, w: 200, h: 60 },
  })
  const drafted = await call("edit_deck", { deck, base: add.rev, runId: add.runId, changes })
  const offSlide = (drafted.findings ?? []).find(({ code }) => code === "off-slide")
  expect(offSlide).toEqual({
    code: "off-slide",
    node: expect.any(String),
    note: expect.stringContaining("130 px past the slide's edge"),
  })
  for (const [index, slide] of slides.entries()) {
    const answer = await call("read_deck", { deck, slide })
    expect(answer.findings ?? []).toEqual(index === 0 ? [offSlide] : [])
    if (index === 0) note(`read_deck findings: ${JSON.stringify(answer.findings)}`)
  }
  const fixed = await call("edit_deck", {
    deck,
    base: drafted.rev,
    runId: drafted.runId,
    changes: [
      { op: "delete", nodes: [offSlide.node] },
      ...slides.flatMap((slide, index) => [
        { op: "set", target: slide + ".title", text: conclusions[index] },
        {
          op: "add",
          kind: "text",
          slide,
          textStyle: "caption",
          text: "Note: Figures rounded. Source: Quarterly management accounts",
          box: { x: 160, y: 930, w: 1500, h: 55 },
        },
      ]),
    ],
  })
  const cleared = (answer) => expect(answer.findings ?? []).toEqual([])
  cleared(fixed)
  for (const [index, slide] of slides.entries()) {
    const answer = await call("read_deck", { deck, slide })
    cleared(answer)
    expect(answer.layers).toContain(conclusions[index])
    expect(answer.layers).toContain("Source: Quarterly management accounts")
  }
  const measured = await call("read_deck", { deck, slide: slides[4] })
  expect(measured.layers).toMatch(/1600x123\.2 style=title/)
  note("The 17-word title wrapped to two measured lines at the default 56 px.")
  note(
    "One edit fixed all five slides. Fresh reads confirmed the saved command titles and sources, and the layout findings cleared.",
  )
}
