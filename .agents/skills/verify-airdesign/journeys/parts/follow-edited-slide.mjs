export async function followEditedSlide({ kit, deck, first, cookie, view, painted, execute, tell, ask, unfaulted }) {
  const { expect, capture, note } = kit
  const three = await execute({
    deck,
    script: `
      const second = insert({ kind: "slide", after: ${JSON.stringify(first)} })
      insert({ parent: second, kind: "text", textStyle: "title", text: "Where we went" })
      insert({ kind: "slide", after: second })
    `,
  })
  const third = three.structuredContent.result
  const editThird = {
    deck,
    script: `insert({ parent: ${JSON.stringify(third)}, kind: "text", textStyle: "title", text: "Where we go next", box: { x: 120, y: 240, w: 1580, h: 210 } })`,
  }
  await tell("view", "ui/notifications/tool-input", { arguments: editThird })
  const edited = await execute(editThird)
  expect(edited.structuredContent).not.toHaveProperty("screenshots")
  const layer = edited.structuredContent.result
  const saved = await kit.post(kit.doomRoutes.open, { deck }, cookie)
  expect(saved.json.fold.nodes[layer].text.chars).toBe("Where we go next")
  const thumb = view.locator(`[data-view-thumb="${third}"]`)
  await unfaulted(expect(thumb.locator(`[data-node="${layer}"]`)).toBeVisible())
  await unfaulted(expect(painted).toBeVisible())
  await tell("view", "ui/notifications/tool-result", edited)
  await ask("view", "ping", {})
  await capture("chat-view-edited-slide")
  await unfaulted(expect(view.locator(`[data-view-slide="${third}"]`)).toBeVisible())
  await expect(view.locator("[data-view-thumb]").nth(2)).toHaveAttribute("data-view-thumb", third)
  await expect(thumb).toHaveAttribute("aria-current", "true")
  note(
    `An outside agent edited slide 3 (${third}) without screenshot(). The server kept the edit, and the chat showed slide 3 as soon as it received the answer.`,
  )
}
