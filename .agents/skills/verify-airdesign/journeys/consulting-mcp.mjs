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
  const created = await call("execute", { script: 'createDeck({ name: "Regional revenue", style: "consulting" })' })
  const { deck, theme } = created
  const style = await call("get_style", { name: "consulting" })
  const opened = await call("execute", { deck, script: "get()" })
  expect(opened.result).toMatchObject({ style: style.name, theme })
  expect(theme).toMatchObject({
    colors: { accent1: expect.stringMatching(/^#[a-f0-9]{6}$/i) },
    fonts: { heading: expect.any(String), body: expect.any(String) },
    sizes: { title: expect.any(Number) },
  })
  const variables = await call("execute", { deck, script: 'variables({ style: "neutral" })' })
  const neutral = await call("execute", { deck, script: "get()" })
  expect(neutral.result).toMatchObject({ style: "neutral", theme: variables.result })
  expect(neutral.result.theme).not.toEqual(theme)
  await call("stop_run", { deck, runId: variables.runId })
  note(
    "Creating with consulting, reading its style text, and reading the saved deck agree on consulting. Switching to neutral saves the new theme values and style name.",
  )
  const labels = ["Revenue by region", "Market overview", "Q3 results", "Profit by year", "Volume by segment"]
  const conclusions = [
    "Rework pricing strategy",
    "Approve phase 2 budget",
    "Adopt new operating model",
    "Profit grew across all regions",
    "Retiree Health Benefit funding requirements are a significant burden, equal to 12% of total revenue in 2010",
  ]
  const drafted = await call("execute", {
    deck,
    script: `
      const [cover] = get().slides
      const labels = ${JSON.stringify(labels)}
      const slides = labels.map((label) => {
        const s = insert({ kind: "slide" })
        insert({ parent: s, kind: "text", textStyle: "title", text: label, box: { x: 160, y: 80, w: 1600, h: 120 } })
        ;[14, 10].forEach((value, bar) =>
          insert({ parent: s, kind: "shape", name: bar === 0 ? "North" : "South", fill: bar === 0 ? "accent1" : "accent2", box: { x: 160 + bar * 260, y: 800 - value * 30, w: 200, h: value * 30 } }),
        )
        return s
      })
      remove({ target: cover })
      insert({ parent: slides[0], kind: "shape", box: { x: 1850, y: 900, w: 200, h: 60 } })
      slides
    `,
  })
  const slides = drafted.result
  expect(slides).toHaveLength(5)
  const offSlide = drafted.problems.find(({ code }) => code === "off-slide")
  expect(offSlide).toEqual({
    code: "off-slide",
    node: expect.any(String),
    note: expect.stringContaining("130 px past the slide's edge"),
  })
  note(`execute problems: ${JSON.stringify(drafted.problems)}`)
  const fixed = await call("execute", {
    deck,
    runId: drafted.runId,
    script: `
      const conclusions = ${JSON.stringify(conclusions)}
      remove({ target: ${JSON.stringify(offSlide.node)} })
      const slides = ${JSON.stringify(slides)}
      slides.forEach((s, i) => {
        update({ target: s + ".title", text: conclusions[i] })
        insert({ parent: s, kind: "text", textStyle: "caption", text: "Note: Figures rounded. Source: Quarterly management accounts", box: { x: 160, y: 930, w: 1500, h: 55 } })
      })
      slides.map((s) => get({ target: s }))
    `,
  })
  expect(fixed.problems).toEqual([])
  for (const [index, read] of fixed.result.entries()) {
    expect(read.problems).toEqual([])
    expect(read.layers).toContain(conclusions[index])
    expect(read.layers).toContain("Source: Quarterly management accounts")
  }
  expect(fixed.result[4].layers).toMatch(/1600x123\.2 style=title/)
  const stopped = await call("stop_run", { deck, runId: fixed.runId })
  expect(stopped).toMatchObject({ ok: true })
  note("The 17-word title wrapped to two measured lines at the default 56 px.")
  note(
    "Two execute calls built and fixed all five slides; get inside the second confirmed the titles, sources and cleared problems.",
  )
}
