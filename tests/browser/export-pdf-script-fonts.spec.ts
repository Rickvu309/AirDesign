import { expect } from "@playwright/test"
import { exportCopy } from "../../apps/web/src/copy/export-copy"
import { fontRoutes } from "../../packages/fonts/src/index.ts"
import { test } from "./api-stack"
import { clickSlide, openEditor } from "./editor-deck"
import { dialog, exportButton, printTitles, recordPrints } from "./export-pdf-controls"

test.use({ viewport: { width: 1600, height: 1000 } })

test("Japanese and Korean typed in Inter use served script faces in the canvas, filmstrip and PDF", async ({
  page,
  context,
  stack,
}) => {
  await recordPrints(page)
  await openEditor(page, context, stack)
  const requests: string[] = []
  page.on("request", (request) => {
    const url = new URL(request.url())
    if (url.pathname === fontRoutes.file.path) requests.push(url.searchParams.get("family") ?? "")
  })
  const japanese = "東京で会議"
  const korean = "안녕하세요"
  await page.keyboard.press("t")
  await clickSlide(page, 200, 700)
  await expect(page.locator("[data-text-editor]")).toBeFocused()
  expect(requests.filter((name) => name.startsWith("Noto Sans"))).toEqual([])
  await page.keyboard.insertText(japanese)
  await page.keyboard.press("Enter")
  await page.keyboard.insertText(korean)
  await page.keyboard.press("Escape")
  const expectScriptFaces = async (scope: string) => {
    for (const { text, script } of [
      { text: japanese, script: "JP" },
      { text: korean, script: "KR" },
    ]) {
      const run = page.locator(`${scope} [data-run]`).getByText(text, { exact: true })
      await expect(run).toHaveCSS("font-family", new RegExp(`airdesign-face-.*Noto%2520Sans%2520${script}`))
    }
  }
  await expectScriptFaces("[data-slide-box]")
  await expectScriptFaces("[data-slide-thumb]")
  await exportButton(page).click()
  await dialog(page).getByRole("button", { name: exportCopy.action }).click()
  await expect.poll(() => printTitles(page)).toHaveLength(1)
  await expectScriptFaces("[data-print-page]")
  expect(requests.filter((name) => name.startsWith("Noto Sans")).sort()).toEqual(["Noto Sans JP", "Noto Sans KR"])
})
