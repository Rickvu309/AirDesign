import { pathToFileURL } from "node:url"
import { quantile } from "../bin/bench-verdict.mjs"
import { openBoardDeck, ready } from "./doom-deck.mjs"

const slideCount = 40
const editable = "[data-text-editor]"

async function seated(kit) {
  const made = await openBoardDeck(kit, slideCount)
  await kit.page.reload()
  await ready(kit.page, made.deck)
  await kit.page.locator('[data-slide-entry="2"]').click()
  await kit.page.waitForTimeout(1500)
  return made
}

async function taskMilliseconds(kit) {
  const session = (kit.cdp ??= await kit.context.newCDPSession(kit.page))
  await session.send("Performance.enable")
  const { metrics } = await session.send("Performance.getMetrics")
  return metrics.find((metric) => metric.name === "TaskDuration").value * 1000
}

async function firstNodeCenter(page) {
  const box = await page.locator("[data-slide-box] [data-node]").first().boundingBox()
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

export const doomOpen = {
  name: "doom-open-40",
  async setup(kit) {
    return seated(kit)
  },
  async measure({ page }, made) {
    const started = Date.now()
    await page.goto(`/s/${made.deck}`)
    await ready(page, made.deck)
    await page.waitForFunction(() => {
      const cells = [...document.querySelectorAll("[data-slide-thumb]")].filter((cell) => {
        const box = cell.getBoundingClientRect()
        return box.bottom > 0 && box.top < innerHeight
      })
      return cells.length > 0 && cells.every((cell) => cell.querySelector("[data-node]") !== null)
    })
    return Date.now() - started
  },
}

export const doomDrag = {
  name: "doom-drag-40",
  async setup(kit) {
    await seated(kit)
    const from = await firstNodeCenter(kit.page)
    await kit.page.mouse.click(from.x, from.y)
    await kit.page.waitForTimeout(3000)
    return from
  },
  async measure(kit, from) {
    const moves = 60
    await kit.page.mouse.move(from.x, from.y)
    await kit.page.mouse.down()
    const before = await taskMilliseconds(kit)
    for (let step = 1; step <= moves; step += 1) await kit.page.mouse.move(from.x + step * 4, from.y + step * 1.5)
    const after = await taskMilliseconds(kit)
    await kit.page.mouse.up()
    return (after - before) / moves
  },
}

export const doomType = {
  name: "doom-type-40",
  async setup(kit) {
    await seated(kit)
    const at = await firstNodeCenter(kit.page)
    await kit.page.mouse.dblclick(at.x, at.y)
    await kit.page.locator(editable).waitFor()
    await kit.page.keyboard.press("End")
  },
  async measure({ page }) {
    const typed = []
    for (const letter of "airdesign") {
      await page.evaluate((editable) => {
        const node = document.querySelector(editable)
        const before = node.textContent.length
        window.benchAnswer = new Promise((resolve) => {
          let pressed
          addEventListener("keydown", (event) => (pressed = event.timeStamp), { capture: true, once: true })
          const watch = new MutationObserver(() => {
            if (pressed === undefined || node.textContent.length <= before) return
            watch.disconnect()
            requestAnimationFrame(() => setTimeout(() => resolve(performance.now() - pressed)))
          })
          watch.observe(node, { subtree: true, childList: true, characterData: true })
        })
      }, editable)
      await page.keyboard.press(letter)
      typed.push(await page.evaluate(() => window.benchAnswer))
    }
    return quantile(
      typed.sort((left, right) => left - right),
      0.5,
    )
  },
}

export const doomAddSlide = {
  name: "doom-add-slide-40",
  async setup(kit) {
    await seated(kit)
  },
  async measure({ page }) {
    const count = await page.locator("[data-slide-entry]").count()
    await page.evaluate((count) => {
      window.benchAnswer = new Promise((resolve) => {
        addEventListener(
          "pointerdown",
          (event) => {
            const pressed = event.timeStamp
            const watch = new MutationObserver(() => {
              if (document.querySelectorAll("[data-slide-entry]").length <= count) return
              watch.disconnect()
              requestAnimationFrame(() => setTimeout(() => resolve(performance.now() - pressed)))
            })
            watch.observe(document.body, { subtree: true, childList: true })
          },
          { capture: true, once: true },
        )
      })
    }, count)
    await page.getByRole("button", { name: "Add slide" }).first().click()
    return page.evaluate(() => window.benchAnswer)
  },
}

export const doomAgentEdit = {
  name: "doom-agent-edit-40",
  async setup(kit) {
    const made = await seated(kit)
    const { doom } = await import(pathToFileURL(`${kit.repo}/packages/document/dist/index.js`).href)
    return { ...made, doom, runs: 0 }
  },
  async measure(kit, state) {
    const { page, post, doomRoutes } = kit
    const { doom, deck, cookie } = state
    const fold = doom.readFold((await post(doomRoutes.open, { deck }, cookie)).json.fold)
    const slide = doom.slidesOf(fold)[1].id
    const target = fold.children.get(slide)[1]
    const box = fold.nodes.get(target).box
    await page.evaluate((id) => {
      const first = document.querySelector(`[data-slide-box] [data-node="${id}"]`)
      const before = first?.getAttribute("style")
      window.benchAnswer = new Promise((resolve) => {
        const watch = new MutationObserver(() => {
          const now = document.querySelector(`[data-slide-box] [data-node="${id}"]`)
          if (now?.getAttribute("style") === before) return
          watch.disconnect()
          requestAnimationFrame(() => setTimeout(() => resolve(Date.now())))
        })
        watch.observe(document.querySelector("[data-slide-box]"), { subtree: true, childList: true, attributes: true })
      })
    }, target)
    state.runs += 1
    const edit = {
      once: `bench-agent-${state.runs}`,
      author: { kind: "agent", id: "aira", run: "bench-run" },
      writes: [{ node: target, prop: "box", value: { ...box, x: box.x + 40 }, base: fold.revs.get(target).get("box") }],
    }
    const sent = Date.now()
    const landed = await post(doomRoutes.edit, { deck, edit }, cookie)
    if (landed.json.ok !== true) throw new Error(`agent edit refused ${JSON.stringify(landed.json)}`)
    return (await page.evaluate(() => window.benchAnswer)) - sent
  },
}

export const doomIdle = {
  name: "doom-idle-40",
  async setup(kit) {
    await seated(kit)
    const from = await firstNodeCenter(kit.page)
    await kit.page.mouse.click(from.x, from.y)
    await kit.page.keyboard.press("ArrowRight")
    await kit.page.waitForTimeout(200)
  },
  async measure(kit) {
    const before = await taskMilliseconds(kit)
    await kit.page.waitForTimeout(4000)
    return (await taskMilliseconds(kit)) - before
  },
}

export const doomCases = [doomOpen, doomDrag, doomType, doomAddSlide, doomAgentEdit, doomIdle]
