import path from "node:path"
import { readFile } from "node:fs/promises"
import { expect } from "@playwright/test"

export default async function drive({ repo, page, signIn, post, deckRoutes, capture, note }) {
  const { cookie } = await signIn()
  for (const name of ["Cedar", "Birch", "Aspen"]) {
    await page.goto("/")
    await page.locator("input[type=file]").setInputFiles({
      name: `${name}.pptx`,
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      buffer: await readFile(path.join(repo, "scripts/pptx-fixtures/clean.pptx")),
    })
    await expect(page).toHaveURL(/\/deck\/[^/]+$/)
    await expect
      .poll(async () => (await post(deckRoutes.list, {}, cookie)).json.decks?.some((deck) => deck.name === name))
      .toBe(true)
  }
  const cards = page.locator("[data-decks-main] article")
  const names = () => cards.locator("h2").allTextContents()
  const move = async (name, keyboard = false) => {
    await page.getByRole("button", { name: `${name} actions` }).click()
    const item = page.getByRole("menuitem", { name: "Move to Trash" })
    if (keyboard) await item.press("Enter")
    else await item.click()
    await expect(page.getByText(`${name} moved to Trash`, { exact: true })).toBeVisible()
  }
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.addInitScript(() => {
    window.gridMotion = { events: [], pause: false }
    document.addEventListener("transitionrun", (event) => {
      if (!event.target.matches("[data-deck], [data-deck-exit]")) return
      const animations = event.target.getAnimations()
      window.gridMotion.events.push({
        name: event.target.querySelector("h2")?.textContent,
        property: event.propertyName,
        duration: animations.map((animation) => animation.effect.getTiming().duration),
      })
      if (window.gridMotion.pause) animations.forEach((animation) => animation.pause())
    })
  })
  await page.goto("/")
  await expect(cards).toHaveCount(3)
  await expect.poll(names).toEqual(["Aspen", "Birch", "Cedar"])
  const oldSlot = await cards.first().boundingBox()
  const events = () => page.evaluate(() => window.gridMotion.events)
  const reset = () =>
    page.evaluate(() => {
      window.gridMotion.events = []
    })
  const settle = () =>
    page.evaluate(async () => {
      const animations = [...document.querySelectorAll("[data-deck], [data-deck-exit]")].flatMap((card) =>
        card.getAnimations(),
      )
      animations.forEach((animation) => animation.play())
      await Promise.all(animations.map((animation) => animation.finished.catch(() => {})))
    })
  expect(await events()).toEqual([])
  await capture("grid-before-trash")
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await move("Aspen")
  await expect
    .poll(events)
    .toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Birch", property: "transform", duration: [220] }),
        expect.objectContaining({ name: "Aspen", property: "opacity" }),
      ]),
    )
  await expect(page.getByRole("heading", { level: 1, name: "Recents" })).toBeFocused()
  await settle()
  expect(await names()).toEqual(["Birch", "Cedar"])
  await reset()
  await page.getByRole("button", { name: "Undo", exact: true }).click()
  await expect.poll(names).toEqual(["Aspen", "Birch", "Cedar"])
  await expect
    .poll(events)
    .toEqual(expect.arrayContaining([expect.objectContaining({ name: "Aspen", property: "opacity" })]))
  await settle()
  expect(await cards.first().boundingBox()).toEqual(oldSlot)
  await expect(page.getByRole("heading", { level: 1, name: "Recents" })).toBeFocused()
  expect((await events()).every((event) => ["transform", "opacity"].includes(event.property))).toBe(true)
  await capture("grid-after-undo")
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await reset()
  await page.getByRole("searchbox").fill("Birch")
  await expect(cards).toHaveCount(1)
  await page.getByRole("searchbox").fill("")
  await expect(cards).toHaveCount(3)
  expect(await events()).toEqual([])
  await move("Aspen", true)
  await settle()
  expect(await events()).toEqual([])
  await page.getByRole("button", { name: "Undo", exact: true }).press("Enter")
  await expect(cards).toHaveCount(3)
  expect(await events()).toEqual([])
  await page.evaluate(() => {
    window.gridMotion.pause = true
  })
  await move("Aspen")
  await expect.poll(events).not.toEqual([])
  await move("Birch")
  await expect(cards).toHaveCount(1)
  await expect.poll(async () => (await post(deckRoutes.list, {}, cookie)).json.trash?.length).toBe(2)
  await page.getByRole("button", { name: "Undo", exact: true }).first().click()
  await expect(cards).toHaveCount(2)
  await page.evaluate(() => {
    window.gridMotion.pause = false
  })
  await settle()
  expect(await cards.evaluateAll((cards) => cards.every((card) => getComputedStyle(card).transform === "none"))).toBe(
    true,
  )
  await expect(page.locator("[data-deck-exit]")).toHaveCount(0)
  await page.emulateMedia({ reducedMotion: "reduce" })
  await reset()
  const restored = (await names()).find((name) => name !== "Cedar")
  await move(restored)
  await expect(cards).toHaveCount(1)
  expect(await events()).toEqual([])
  await page.getByRole("button", { name: "Undo", exact: true }).first().click()
  await expect(cards).toHaveCount(2)
  expect(await events()).toEqual([])
  await capture("grid-reduced-motion")
  await page.goto("/?view=list")
  await expect(cards).toHaveCount(2)
  await cards.first().getByRole("button", { name: "Move to Trash" }).click()
  await expect(cards).toHaveCount(1)
  expect(await events()).toEqual([])
  await page.goto("/trash")
  await expect(cards).toHaveCount(2)
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await cards.first().getByRole("button", { name: "Restore", exact: true }).click()
  await expect(cards).toHaveCount(1)
  await expect.poll(events).not.toEqual([])
  await settle()
  await expect(page.getByRole("heading", { level: 1, name: "Trash" })).toBeFocused()
  await capture("trash-after-restore")
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await reset()
  await cards.first().getByRole("button", { name: "Restore", exact: true }).click()
  await expect(cards).toHaveCount(0)
  await expect.poll(events).not.toEqual([])
  await settle()
  await page.goto("/")
  await expect.poll(names).toEqual(["Aspen", "Birch", "Cedar"])
  await page.emulateMedia({ reducedMotion: "reduce" })
  await move("Aspen")
  await move("Birch")
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await reset()
  await move("Cedar")
  await expect(cards).toHaveCount(0)
  await expect
    .poll(events)
    .toEqual(expect.arrayContaining([expect.objectContaining({ name: "Cedar", property: "opacity" })]))
  await settle()
  await reset()
  await page
    .locator("[data-sonner-toast]")
    .filter({ hasText: "Cedar moved to Trash" })
    .getByRole("button", { name: "Undo" })
    .click()
  await expect.poll(names).toEqual(["Cedar"])
  await expect
    .poll(events)
    .toEqual(expect.arrayContaining([expect.objectContaining({ name: "Cedar", property: "opacity" })]))
  await settle()
  note(
    "Real API: Trash, Undo, keyboard, search, reduced motion, and second Trash during paused first shift passed; only transform and opacity transitions.",
  )
}
