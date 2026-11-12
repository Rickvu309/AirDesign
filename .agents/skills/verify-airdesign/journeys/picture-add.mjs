import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import { expect } from "@playwright/test"

const pictureKey = "ppt/slides/slide1.xml#4"

async function painted(picture) {
  await expect(picture).toBeVisible()
  await expect.poll(async () => picture.evaluate((node) => getComputedStyle(node).backgroundImage)).toContain("blob:")
}

export default async function drive({ repo, page, context, signIn, post, capture, note, deckRoutes }) {
  const { cookie } = await signIn()
  const file = path.join(repo, "scripts/pptx-fixtures/picture.png")
  const bytes = readFileSync(file)
  const sha256 = createHash("sha256").update(bytes).digest("hex")
  await page.goto("/")
  const origin = new URL(page.url()).origin
  const adding = await context.browser().newContext({
    baseURL: origin,
    viewport: { width: 1470, height: 923 },
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
  })
  await adding.addCookies(await context.cookies())
  const first = await adding.newPage()
  await first.route("**/verify-original/**", (route) =>
    route.request().method() === "PUT" && route.request().postDataBuffer()?.length === bytes.length
      ? route.abort()
      : route.continue(),
  )
  await first.goto("/")
  await first.getByRole("button", { name: "New deck", exact: true }).click()
  await first.getByRole("button", { name: "Blank deck", exact: true }).click()
  await expect(first).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = first.url().split("/").at(-1)
  await expect.poll(async () => (await post(deckRoutes.original, { deck }, cookie)).json.ok).toBe(true)
  const choosing = first.waitForEvent("filechooser")
  await first.getByRole("button", { name: "Add picture", exact: true }).click()
  await (await choosing).setFiles(file)
  await painted(first.locator(`[data-slide-paint] [data-canvas-element="${pictureKey}"]`))
  const order = async () => (await post(deckRoutes.open, { deck }, cookie)).json.register.order
  await expect
    .poll(async () => (await order()).find((row) => row.slide === "element-add")?.media)
    .toEqual({ sha256, type: "image/png" })
  expect((await post(deckRoutes.media, { deck, sha256 }, cookie)).json).toEqual({ ok: false, refusal: "missing" })
  const out = path.dirname(await capture("signed-in"))
  await first.screenshot({ path: path.join(out, "first-device-picture-added.png") })

  await page.goto(`/deck/${deck}`)
  const picture = page.locator(`[data-slide-paint] [data-canvas-element="${pictureKey}"]`)
  await expect(picture).toContainText("Picture is still uploading from another device")
  await capture("picture-uploading")
  await page.getByRole("button", { name: "Export", exact: true }).click()
  await expect(page.getByText("Unable to export. A picture is uploading.")).toBeVisible()
  await capture("export-waiting")

  await first.unroute("**/verify-original/**")
  await first.reload()
  await expect.poll(async () => (await post(deckRoutes.media, { deck, sha256 }, cookie)).json.ok).toBe(true)
  await adding.close()

  await page.reload()
  await painted(picture)
  await capture("picture-added")
  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export", exact: true }).click()
  const exported = path.join(out, "picture-add.pptx")
  await (await downloading).saveAs(exported)
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(exported)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await painted(picture)
  await capture("reimported")
  note(
    `Add picture painted the PNG at once on the device that added it while its upload was blocked; the server's order held an element-add with sha256 ${sha256.slice(0, 12)}… and image/png, and /decks/media answered missing. A second device opened the deck, painted the box with "Picture is still uploading from another device" and refused export with "Unable to export. A picture is uploading." Once the first device reloaded, the bytes uploaded, the second device painted the picture, exported ${path.basename(exported)}, and a new import of that file painted it.`,
  )
}
