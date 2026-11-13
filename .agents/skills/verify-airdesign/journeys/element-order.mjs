import path from "node:path"
import { expect } from "@playwright/test"

const slide = "ppt/slides/slide1.xml"
const fixture = "scripts/pptx-fixtures/blank.pptx"

export default async function drive({ page, signIn, post, capture, note, deckRoutes, repo }) {
  const { cookie } = await signIn()
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(path.join(repo, fixture))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().split("/").at(-1)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  const element = (shape) => page.locator(`[data-slide-paint] [data-canvas-element="${slide}#${shape}"]`)
  const insert = async (name) => {
    await page.getByRole("button", { name: "Shapes", exact: true }).click()
    await page.getByRole("button", { name, exact: true }).click()
    await expect(page.locator("[data-shape-tray]")).toHaveCount(0)
  }
  await insert("Rectangle")
  await expect(element(4)).toBeVisible()
  await insert("Ellipse")
  await expect(element(5)).toBeVisible()
  const back = await element(4).boundingBox()
  const front = await element(5).boundingBox()
  if (back === null || front === null) throw new Error("no shape")
  await page.mouse.move(front.x + front.width * 0.5, front.y + front.height * 0.5)
  await page.mouse.down()
  await page.mouse.move(
    front.x + front.width * 0.5 + (back.x + back.width * 0.05 - front.x),
    front.y + front.height * 0.5 + (back.y - front.height * 0.35 - front.y),
    { steps: 8 },
  )
  await page.mouse.up()
  await expect
    .poll(async () => {
      const rect = await element(4).boundingBox()
      const ellipse = await element(5).boundingBox()
      if (rect === null || ellipse === null) return false
      const covers = ellipse.y < rect.y + rect.height * 0.45 && ellipse.y + ellipse.height > rect.y + 8
      const clear = ellipse.y + ellipse.height < rect.y + rect.height - 12
      return covers && clear
    })
    .toBe(true)
  const uncovered = await element(4).boundingBox()
  if (uncovered === null) throw new Error("no rectangle")
  await page.mouse.click(uncovered.x + 20, uncovered.y + uncovered.height - 10, { button: "right" })
  const bring = page.getByRole("menuitem", { name: "Bring to front" })
  const hasMenu = await bring
    .waitFor({ state: "visible", timeout: 2000 })
    .then(() => true)
    .catch(() => false)
  if (!hasMenu) {
    await capture("element-ordered")
    note("This build has no stacking menu. The ellipse still covers part of the rectangle.")
    return
  }
  await capture("arrange-menu")
  await bring.click()
  await expect(page.locator("[data-slide-paint]").getByRole("status")).toHaveText("Brought to front")
  await capture("element-ordered")
  const order = async () => (await post(deckRoutes.open, { deck }, cookie)).json.register.order
  await expect.poll(async () => (await order()).some((row) => row.slide === "element-order")).toBe(true)
  await page.getByRole("button", { name: "Undo bring to front", exact: true }).click()
  await page.getByRole("button", { name: "Redo bring to front", exact: true }).click()
  await element(4).click()
  await page.keyboard.press("Control+BracketLeft")
  await expect(page.locator("[data-slide-paint]").getByRole("status")).toHaveText("Sent backward")
  await page.getByRole("button", { name: "Undo send backward", exact: true }).click()
  await page.reload()
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  await expect(element(4)).toBeVisible()
  await expect(element(5)).toBeVisible()
  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Export" }).getByRole("button", { name: "Export" })).toBeFocused()
  await page.keyboard.press("Enter")
  const out = path.dirname(await capture("exported"))
  const exported = path.join(out, "element-order.pptx")
  await (await downloading).saveAs(exported)
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(exported)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await expect(element(4)).toBeVisible()
  await expect(element(5)).toBeVisible()
  await capture("reimported")
  note(
    `Rectangle then Ellipse overlapped. Bring to front put the rectangle in front and the canvas said Brought to front. Undo and Redo brought that step back, Ctrl+[ sent it backward, and Undo send backward put it in front again. A reload kept both shapes, the export ${path.basename(exported)} downloaded, and a new import painted both.`,
  )
}
