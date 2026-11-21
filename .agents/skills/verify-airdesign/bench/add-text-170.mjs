import path from "node:path"
import { placeText } from "../bin/text-place.mjs"
import { home, imported, painted } from "./import.mjs"

const editable = '[data-slide-paint] [contenteditable="true"]'
const letter = "Q"
const slide = "256"
const shapeCount = 160
const frameCount = 5
const perFrame = 3
const firstId = 4

function shapeBox(index) {
  const column = index % 8
  const row = Math.floor(index / 8)
  return {
    x: 254_000 + column * 1_397_000,
    y: 254_000 + row * 304_800,
    cx: 1_270_000,
    cy: 254_000,
  }
}

function shapeText(index) {
  return JSON.stringify([
    { from: 0, runs: [{ from: -1, text: `Heading ${index}`, bold: true, size: 1400 }] },
    { from: 0, runs: [{ from: -1, text: `$1.${index}M` }] },
    { from: 0, runs: [{ from: -1, text: "One point" }] },
    { from: 0, runs: [{ from: -1, text: "Two point" }] },
  ])
}

function shapeEdits(start, count) {
  const batch = []
  for (let offset = 0; offset < count; offset += 1) {
    const index = start + offset
    const node = `${slide}.${firstId + index}`
    batch.push(
      {
        slide: "element-add",
        id: slide,
        file: [slide],
        element: { node, kind: "shape", value: "", box: shapeBox(index), grouped: false },
      },
      {
        node,
        v: 2,
        patch: {
          text: { value: { set: shapeText(index) } },
          fills: {
            p0: { set: { solid: { scheme: index % 3 === 0 ? "accent1" : "accent2" } } },
            p1: { set: { none: true } },
            p2: { set: { none: true } },
            p3: { set: { none: true } },
          },
          geometry: { shape: { set: { preset: "roundRect", adjust: {} } } },
          border: { width: { set: 12_700 } },
          body: { anchor: { set: "ctr" } },
        },
      },
    )
  }
  return batch
}

function frameEdits() {
  const batch = []
  let nextId = firstId + shapeCount
  for (let frame = 0; frame < frameCount; frame += 1) {
    const rowStart = frame * 8
    const members = []
    for (let slot = 0; slot < perFrame; slot += 1) {
      const index = rowStart + slot
      members.push({ node: `${slide}.${firstId + index}`, box: shapeBox(index) })
    }
    const left = Math.min(...members.map((member) => member.box.x))
    const top = Math.min(...members.map((member) => member.box.y))
    const right = Math.max(...members.map((member) => member.box.x + member.box.cx))
    const bottom = Math.max(...members.map((member) => member.box.y + member.box.cy))
    const box = { x: left, y: top, cx: right - left, cy: bottom - top }
    const groupNode = `${slide}.${nextId}`
    const backdropNode = `${slide}.${nextId + 1}`
    nextId += 2
    batch.push({
      slide: "element-group",
      id: slide,
      file: [slide],
      element: { node: groupNode, kind: "group", value: null, box, grouped: false },
      backdrop: { node: backdropNode, kind: "shape", value: null, box, grouped: false },
      members,
    })
  }
  return batch
}

async function commitBatch(post, deckRoutes, cookie, deck, batch) {
  const answer = await post(deckRoutes.commit, { deck, batch }, cookie)
  if (answer.status !== 200 || answer.json?.ok !== true) {
    throw new Error(`commit answered ${String(answer.status)}: ${JSON.stringify(answer.json)}`)
  }
}

export default {
  name: "add-text-170",
  async setup({ repo, page, signIn, post, deckRoutes, expect }) {
    const { cookie } = await signIn()
    await home(page)
    const deck = await imported(page, path.join(repo, "scripts/pptx-fixtures/blank.pptx"))
    await home(page)
    const perBatch = 40
    for (let start = 0; start < shapeCount; start += perBatch) {
      await commitBatch(post, deckRoutes, cookie, deck, shapeEdits(start, Math.min(perBatch, shapeCount - start)))
    }
    await commitBatch(post, deckRoutes, cookie, deck, frameEdits())
    await page.goto(`/deck/${deck}`)
    await painted(page, deck)
    await expect(page.locator("[data-slide-paint] [data-canvas-element]").nth(shapeCount - 1)).toBeVisible()
  },
  async measure({ page }) {
    await page.evaluate(
      ({ editable, letter }) => {
        const before = new Set(document.querySelectorAll(editable))
        window.benchAnswer = new Promise((resolve) => {
          let clicked
          addEventListener("click", (event) => (clicked = event.timeStamp), { capture: true, once: true })
          const watch = new MutationObserver(() => {
            const typed = [...document.querySelectorAll(editable)].some(
              (node) => !before.has(node) && node.textContent.includes(letter),
            )
            if (clicked === undefined || !typed) return
            watch.disconnect()
            requestAnimationFrame(() => setTimeout(() => resolve(performance.now() - clicked)))
          })
          watch.observe(document.body, { subtree: true, childList: true, characterData: true })
        })
      },
      { editable, letter },
    )
    await placeText(page)
    await page.keyboard.type(letter, { delay: 0 })
    return page.evaluate(() => window.benchAnswer)
  },
}
