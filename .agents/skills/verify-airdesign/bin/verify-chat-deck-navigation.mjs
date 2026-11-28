import { createRequire } from "node:module"
import { expect } from "@playwright/test"
import { hostLook } from "./chat-host.mjs"

const { deckViewCopy } = createRequire(import.meta.url)("../../../../apps/web/src/copy/deck-view-copy.ts")

export async function pickBar(painted, bar) {
  const scale = (await painted.boundingBox()).width / 1920
  await painted.click({ position: { x: (bar.x + bar.w / 2) * scale, y: (bar.y + bar.h / 2) * scale } })
}

async function slidePixels(page, painted) {
  const box = await painted.boundingBox()
  return page.screenshot({ clip: { x: box.x + 2, y: box.y + 2, width: box.width - 4, height: box.height - 4 } })
}

async function chromeContrast(header) {
  const ratios = await header.evaluate((element) => {
    const canvas = document.createElement("canvas").getContext("2d", { willReadFrequently: true })
    const luminance = (color) => {
      canvas.fillStyle = color
      canvas.fillRect(0, 0, 1, 1)
      const channels = Array.from(canvas.getImageData(0, 0, 1, 1).data.slice(0, 3), (value) => {
        const srgb = value / 255
        return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
      })
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
    }
    const background = luminance(getComputedStyle(element).backgroundColor)
    return ["h1", "[aria-live]"].map((selector) => {
      const text = luminance(getComputedStyle(element.querySelector(selector)).color)
      return (Math.max(text, background) + 0.05) / (Math.min(text, background) + 0.05)
    })
  })
  for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5)
  return ratios.map((ratio) => ratio.toFixed(2))
}

async function trackSlidePaint(button, next) {
  await button.evaluate((element, next) => {
    window.slidePaintTime = new Promise((resolve, reject) => {
      let ended = false
      const timeout = setTimeout(() => {
        ended = true
        reject(new Error(`Slide ${next} did not paint within 2 seconds`))
      }, 2000)
      element.addEventListener(
        "click",
        () => {
          const start = performance.now()
          const check = () => {
            if (ended) return
            const slide = document.querySelector(`[data-view-slide="${next}"]`)
            if (slide === null || slide.hasAttribute("data-fonts-pending")) return requestAnimationFrame(check)
            requestAnimationFrame(() => {
              clearTimeout(timeout)
              resolve(performance.now() - start)
            })
          }
          requestAnimationFrame(check)
        },
        { once: true, capture: true },
      )
    })
  }, next)
}

export async function verifyChatDeckNavigation({
  page,
  view,
  painted,
  slide,
  bar,
  captures,
  note,
  seenBy,
  tell,
  edit,
}) {
  await view.getByRole("button", { name: deckViewCopy.clearSelection }).click()
  await expect(view.locator("[data-view-selection], [data-view-selected]")).toHaveCount(0)
  await expect.poll(async () => (await seenBy("view")).contexts.at(-1).structuredContent.selected).toEqual([])

  await edit(`
      for (let number = 2; number <= 5; number++) {
        const next = insert({ kind: "slide" })
        insert({ parent: next, kind: "text", textStyle: "title", text: "Hiking trips · " + number, box: { x: 120, y: 240, w: 760, h: 300 } })
      }
    `)
  const thumbs = view.locator("[data-view-thumb]")
  await expect(thumbs).toHaveCount(5)
  const slideIds = await thumbs.evaluateAll((buttons) => buttons.map((button) => button.dataset.viewThumb))
  const chrome = view.locator("[data-deck-view-ready]")
  const header = view.locator("header")
  const root = view.locator("html")
  const strip = view.getByRole("navigation", { name: "Slides" })
  const showing = view.locator("[data-view-slide]")
  const next = view.getByRole("button", { name: deckViewCopy.nextSlide })
  const previous = view.getByRole("button", { name: deckViewCopy.previousSlide })
  const fullscreen = view.getByRole("button", { name: deckViewCopy.fullscreen, exact: true })
  const exit = view.getByRole("button", { name: deckViewCopy.exitFullscreen })
  const resize = async (width, height) => {
    await page.setViewportSize({ width: width + 48, height: height + 48 })
    await page.locator("#view").evaluate(
      (frame, { width, height }) => {
        Object.assign(frame.style, { width: width + "px", height: height + "px" })
      },
      { width, height },
    )
    await expect.poll(async () => (await chrome.boundingBox()).width).toBe(width)
  }
  const lead = async (minimum) => {
    await expect.poll(async () => (await showing.boundingBox()).width).toBeGreaterThanOrEqual(minimum)
    const box = await showing.boundingBox()
    expect(box.height).toBeGreaterThan((await header.boundingBox()).height)
    expect(await chrome.evaluate((element) => element.scrollWidth)).toBe((await chrome.boundingBox()).width)
  }
  const measure = async (name, targets) => {
    const boxes = Object.fromEntries(
      await Promise.all(Object.entries(targets).map(async ([key, locator]) => [key, await locator.boundingBox()])),
    )
    note(`Chat deck view ${name} boxes: ${JSON.stringify(boxes)}`)
  }

  await resize(300, 250)
  await expect(strip).toBeHidden()
  await expect(previous).toBeDisabled()
  await expect.poll(async () => (await seenBy("view")).sizes.at(-1)?.width).toBe(300)
  await lead(265)
  await captures.narrow()
  await measure("narrow", { header, next, slide: showing })
  await next.click()
  await expect(showing).toHaveAttribute("data-view-slide", slideIds[1])
  await previous.click()
  await expect(showing).toHaveAttribute("data-view-slide", slide)
  note("At 300 px the filmstrip is hidden and the header stepped from slide 1 to 2 and back.")

  await resize(736, 560)
  await expect(strip).toBeVisible()
  await expect(root).toHaveAttribute("data-host-theme", "light")
  await expect(header).toHaveCSS("background-color", "rgb(255, 255, 255)")
  await lead(685)
  await page.mouse.move(0, 0)
  const lightPixels = await slidePixels(page, painted)
  await captures.light()
  await measure("light", { header, fullscreen, slide: showing, strip })

  await page.evaluate(() => {
    document.body.dataset.theme = "dark"
  })
  await tell("view", "ui/notifications/host-context-changed", { theme: "dark", styles: { variables: hostLook } })
  await expect(root).toHaveAttribute("data-host-theme", "dark")
  await expect(header).toHaveCSS("background-color", "rgb(38, 38, 36)")
  await expect(header).toHaveCSS("border-bottom-color", "rgba(250, 249, 245, 0.15)")
  await expect(chrome).toHaveCSS("background-color", "rgb(28, 28, 27)")
  await expect(header.locator("h1")).toHaveCSS("color", "rgb(250, 249, 245)")
  await expect(header.getByText("1 / 5", { exact: true })).toHaveCSS("color", "rgb(204, 202, 193)")
  await expect(strip).toHaveCSS("background-color", "rgb(38, 38, 36)")
  await lead(685)
  expect((await slidePixels(page, painted)).equals(lightPixels)).toBe(true)
  const hostContrast = await chromeContrast(header)
  await captures.dark()
  await measure("dark", { header, fullscreen, slide: showing, strip })
  await tell("view", "ui/notifications/host-context-changed", { styles: { variables: {} } })
  await expect(header).toHaveCSS("background-color", "rgb(30, 30, 30)")
  const fallbackContrast = await chromeContrast(header)
  note(
    `Dark text contrast (title, counter): host ${hostContrast.join(", ")}; theme fallback ${fallbackContrast.join(", ")}. Slide pixels match light mode.`,
  )
  await page.evaluate(() => {
    delete document.body.dataset.theme
  })
  await tell("view", "ui/notifications/host-context-changed", { theme: "light", styles: { variables: hostLook } })
  await expect(root).toHaveAttribute("data-host-theme", "light")

  await pickBar(painted, bar)
  await expect(view.locator("[data-view-selected]")).toBeVisible()
  await page.keyboard.press("ArrowRight")
  await expect(showing).toHaveAttribute("data-view-slide", slideIds[1])
  await expect(view.locator("[data-view-selection]")).toHaveCount(0)
  for (const [key, index] of [
    ["End", 4],
    ["ArrowLeft", 3],
    ["Home", 0],
  ]) {
    await page.keyboard.press(key)
    await expect(showing).toHaveAttribute("data-view-slide", slideIds[index])
  }

  await page.setViewportSize({ width: 1518, height: 871 })
  const sized = (await seenBy("view")).sizes
  await fullscreen.click()
  await expect(exit).toBeVisible()
  await expect(chrome).toHaveCSS("padding-top", "16px")
  await expect(chrome).toHaveCSS("padding-right", "24px")
  await expect(chrome).toHaveCSS("padding-bottom", "16px")
  await expect(chrome).toHaveCSS("padding-left", "24px")
  await lead(1120)
  await pickBar(painted, bar)
  await expect(view.locator("[data-view-selection]")).toContainText("Growth")
  await captures.fullscreen()
  await measure("fullscreen", { header, exit, slide: showing, selection: view.locator("[data-view-selection]") })
  expect((await seenBy("view")).sizes).toEqual(sized)
  await page.keyboard.press("Escape")
  await expect(fullscreen).toBeVisible()
  await expect(view.locator("[data-view-selection]")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(view.locator("[data-view-selection], [data-view-selected]")).toHaveCount(0)
  await fullscreen.click()
  await exit.click()
  await expect(fullscreen).toBeVisible()
  await expect(chrome).toHaveCSS("padding-top", "0px")
  await expect.poll(async () => (await seenBy("view")).modes).toEqual(["fullscreen", "inline", "fullscreen", "inline"])
  await expect.poll(async () => (await seenBy("view")).sizes.length).toBeGreaterThan(sized.length)
  note(
    "Fullscreen applies the insets and leaves sizing to the host. Escape exits first and clears on the next press. Both toggle directions work by click.",
  )

  await resize(736, 560)
  const times = []
  await next.click()
  for (const [index, button] of [
    [0, previous],
    [1, next],
    [2, next],
    [3, next],
    [4, next],
  ]) {
    await trackSlidePaint(button, slideIds[index])
    await button.click()
    times.push(await chrome.evaluate(() => window.slidePaintTime))
  }
  const median = times.toSorted((a, b) => a - b)[2]
  note(
    `Five header steps click-to-paint (ms): ${times.map((time) => time.toFixed(2)).join(", ")}; median ${median.toFixed(2)}.`,
  )
  expect(median).toBeLessThanOrEqual(50)
}
