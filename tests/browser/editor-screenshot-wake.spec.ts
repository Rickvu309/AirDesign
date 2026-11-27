import { expect } from "@playwright/test"
import { test } from "./api-stack"
import { accent, landNodes, openEditor, spot } from "./editor-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

test("an agent's first screenshot reaches a tab that is between two catch-ups and gets the screenshot", async ({
  page,
  context,
  stack,
}) => {
  const { doomRoutes } = await import("../../packages/catalog/src/index.ts")
  const opened = await openEditor(page, context, stack)
  const before = (await stack.post(doomRoutes.open.path, { deck: opened.deck }, opened.cookie)).json as { rev: number }
  let held = true
  let reopen: () => void = () => undefined
  const gap = new Promise<void>((resolve) => {
    reopen = resolve
  })
  await page.route("**/doom/since", async (route) => {
    const from = (route.request().postDataJSON() as { rev: number }).rev
    if (held && from > before.rev) {
      held = false
      await gap
    }
    await route.fallback()
  })
  await landNodes(stack, opened, [
    {
      id: "w:1",
      type: "shape",
      parent: opened.slide,
      props: { box: spot(160, 120, 1600, 200), fills: accent, geometry: { kind: "rect" } },
    },
  ])
  await expect(page.locator('[data-slide-box] [data-node="w:1"]')).toBeVisible()
  const reading = stack.toolBlocks(
    "airdesign_execute",
    { deck: opened.deck, script: `screenshot({ target: "${opened.slide}" })` },
    opened.cookie,
  )
  const head = (await stack.post(doomRoutes.open.path, { deck: opened.deck }, opened.cookie)).json as { rev: number }
  const unseen = { keys: [{ slide: opened.slide, key: "0".repeat(64) }], images: [] }
  await expect
    .poll(
      async () =>
        (
          await stack.post(
            doomRoutes.screenshots.path,
            { deck: opened.deck, rev: head.rev, screenshots: unseen },
            opened.cookie,
          )
        ).json,
    )
    .toMatchObject({ missing: [opened.slide] })
  reopen()
  const blocks = await reading
  expect(blocks.filter((block) => block.type === "image")).toHaveLength(1)
})
