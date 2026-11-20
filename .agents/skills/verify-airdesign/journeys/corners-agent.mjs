import path from "node:path"
import { expect } from "@playwright/test"

const slide = "ppt/slides/slide1.xml"

export default async function drive({ page, signIn, post, capture, note, deckRoutes, repo, aira }) {
  const { geometryCopy } = await import("../../../../apps/web/src/copy/geometry-copy.ts")
  const { transitionCopy } = await import("../../../../apps/web/src/copy/transition-copy.ts")
  const { airaCopy } = await import("../../../../apps/web/src/copy/aira-copy.ts")
  const { cookie } = await signIn()
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(path.join(repo, "scripts/pptx-fixtures/shapes-added.pptx"))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = /[^/]+$/.exec(page.url())?.[0]
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  const saved = async () => (await post(deckRoutes.open, { deck }, cookie)).json
  const card = page.locator(`[data-slide-paint] [data-canvas-element="${slide}#4"]`)
  const before = await card.boundingBox()
  const shape = `${(await saved()).register.index?.slides?.[0]?.id ?? "256"}.4`
  aira([{ name: "corners.sse", fill: { deck, base: String((await saved()).revision), shape } }, { name: "edited.sse" }])
  await page.getByRole("button", { name: "Agent", exact: true }).click()
  await page
    .getByRole("textbox", { name: airaCopy.askAira })
    .fill("Round the card's corners to 12 pt and make it taller")
  await page.keyboard.press("Enter")
  await expect.poll(async () => (await card.boundingBox())?.height ?? 0).toBeGreaterThan((before?.height ?? 0) * 1.9)
  const landed = async () => (await saved()).register.elements[shape]?.landed ?? []
  await expect
    .poll(async () => (await landed()).at(-1))
    .toMatchObject({
      actor: "agent",
      patch: {
        box: { h: { set: 3_657_600 } },
        geometry: { shape: { set: { preset: "roundRect", adjust: { adj: 5_555 } } } },
      },
    })
  await expect((await landed()).at(-2)).toMatchObject({
    actor: "agent",
    patch: { geometry: { shape: { set: { preset: "roundRect", adjust: { adj: 8_333 } } } } },
  })
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await card.click({ position: { x: 30, y: 30 } })
  const corners = page
    .locator("[data-design-element]")
    .getByRole("textbox", { name: geometryCopy.corners, exact: true })
  await expect(corners).toHaveValue("16")
  await capture("aira-rounded-taller")
  note(
    `Aira's replayed edit_deck set the rectangle ${shape} to corners 12 pt, which landed as roundRect adj 8333 on its 216 by 144 pt box, then made it 288 pt tall, which landed in one row with adj 5555 so the radius stayed 12 pt. The Design panel's Corners reads 16 px, the same 12 pt.`,
  )
}
