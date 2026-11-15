const week = 7 * 24 * 60 * 60 * 1000

export function scriptTurns(kit, turns) {
  const usage = { used: 0.4, allowed: 2, resets: new Date(Math.ceil(Date.now() / week) * week).toISOString() }
  const queue = [...turns]
  return kit.page.route(
    (url) => url.pathname === kit.airaRoutes.turn.path,
    (route) => {
      const turn = queue.shift() ?? []
      const lines = turn.map((line) => (line.type === "end" ? { ...line, usage } : line))
      return route.fulfill({
        contentType: "application/x-ndjson",
        body: `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`,
      })
    },
  )
}

export function said(text) {
  return [
    { type: "text", text },
    { type: "end", ok: true, stop: "end_turn", content: [{ type: "text", text }] },
  ]
}
