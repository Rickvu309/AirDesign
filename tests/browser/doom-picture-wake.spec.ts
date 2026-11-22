import { expect } from "@playwright/test"
import { test } from "./api-stack"
import { accent, landNodes, openDoomEditor, spot } from "./doom-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

test("an agent's first picture read reaches a tab that is between two catch-ups and gets the picture", async ({
  page,
  context,
  stack,
}) => {
  const { doomRoutes } = await import("../../packages/catalog/src/index.ts")
  const opened = await openDoomEditor(page, context, stack)
  let held = false
  let reopen: () => void = () => undefined
  const gap = new Promise<void>((resolve) => {
    reopen = resolve
  })
  await page.route("**/doom/since", async (route) => {
    if (held) {
      held = false
      await gap
    }
    await route.fallback()
  })
  held = true
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
    "airdesign_read_deck",
    { deck: opened.deck, picture: true, slide: opened.slide },
    opened.cookie,
  )
  const head = (await stack.post(doomRoutes.open.path, { deck: opened.deck }, opened.cookie)).json as { rev: number }
  const unseen = { keys: [{ slide: opened.slide, key: "0".repeat(64) }], images: [] }
  await expect
    .poll(
      async () =>
        (
          await stack.post(
            doomRoutes.pictures.path,
            { deck: opened.deck, rev: head.rev, pictures: unseen },
            opened.cookie,
          )
        ).json,
    )
    .toMatchObject({ missing: [opened.slide] })
  reopen()
  const blocks = await reading
  expect(blocks.filter((block) => block.type === "image")).toHaveLength(1)
})
