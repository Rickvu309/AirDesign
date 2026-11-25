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
    "Northern revenue leads by 40%",
    "Southern revenue is catching up",
    "Third-quarter revenue doubled",
    "Profit grew across all regions",
    "Volume is highest in the North",
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
    {
      op: "add",
      kind: "chart",
      slide,
      chart: {
        kind: "column",
        categories: ["North", "South"],
        series: [{ name: "Revenue", values: [14, 10] }],
        unit: "$M",
      },
      box: { x: 160, y: 230, w: 1500, h: 650 },
    },
  ])
  const drafted = await call("edit_deck", { deck, base: add.rev, runId: add.runId, changes })
  const hasAdvice = (answer, slide) => {
    const findings = answer.findings.filter((finding) => finding.slide === slide)
    expect(findings.map(({ code }) => code).sort()).toEqual(["no-source", "title-label"])
    for (const { note } of findings) expect(note).toMatch(/^[A-Z][^\n]+\.$/)
  }
  for (const slide of slides) hasAdvice(drafted, slide)
  for (const slide of slides) hasAdvice(await call("read_deck", { deck, slide }), slide)
  note("The edit and five slide reads returned title-label and no-source in structuredContent.")
  const fixed = await call("edit_deck", {
    deck,
    base: drafted.rev,
    runId: drafted.runId,
    changes: slides.flatMap((slide, index) => [
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
  })
  const cleared = (answer) => expect((answer.findings ?? []).filter((finding) => finding.slide)).toEqual([])
  cleared(fixed)
  for (const [index, slide] of slides.entries()) {
    const answer = await call("read_deck", { deck, slide })
    cleared(answer)
    expect(answer.layers).toContain(conclusions[index])
    expect(answer.layers).toContain("Source: Quarterly management accounts")
  }
  note(
    "One edit fixed all five slides. Fresh reads confirmed the saved titles and sources, and the consulting findings cleared.",
  )
}
