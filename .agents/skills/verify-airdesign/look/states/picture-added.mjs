import { readFile } from "node:fs/promises"
import path from "node:path"
import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { openDoomDeck, slidePoint } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit)
  const bytes = [...(await readFile(path.join(kit.repo, "tests/browser/fixtures/picture.png")))]
  const at = await slidePoint(page, 1300, 540)
  await page.evaluate(
    ([bytes, at]) => {
      const transfer = new DataTransfer()
      transfer.items.add(new File([new Uint8Array(bytes)], "picture.png", { type: "image/png" }))
      document.querySelector("[data-editor-stage]").dispatchEvent(
        new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          dataTransfer: transfer,
          clientX: at.x,
          clientY: at.y,
        }),
      )
    },
    [bytes, at],
  )
  const picture = page.locator('[data-slide-box] [data-paint="image"]')
  await expect(picture).toHaveCount(1)
  await expect.poll(() => picture.evaluate((each) => getComputedStyle(each).backgroundImage)).toContain("blob:")
}

export default { name: "picture-added", design: editor, drive }
