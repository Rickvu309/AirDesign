import { expect, test, type Page } from "@playwright/test"
import {
  hoverFindings,
  safeAreaFindings,
  themeColorFindings,
  themeColorFor,
  viewportFindings,
  viewportHeightFindings,
  viewportReachFindings,
} from "../site-mobile/site-rules.ts"
import { pagesIn, serveSite, signedOut, stylesOf, type ServedSite } from "./site-server.ts"

const paths = ["/", "/sign-in", "/sign-in/check", "/sign-in/expired", "/privacy", "/terms"]
const phone = { width: 390, height: 844 }
const widths = [{ width: 320, height: 568 }, phone, { width: 844, height: 390 }]

let site: ServedSite

test.beforeAll(async () => {
  site = await serveSite()
})

test.afterAll(async () => {
  await site.close()
})

test.use({ storageState: signedOut, viewport: phone, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })

async function open(page: Page, path: string) {
  await page.addInitScript(() => sessionStorage.setItem("airdesign.pending-sign-in-email", "a@b.com"))
  await page.goto(`${site.origin}${path}`)
  await page.evaluate(() => document.fonts.ready)
}

test("every built page keeps zoom on, reaches under the notch, answers the keyboard, and gates hover on a mouse", () => {
  const built = pagesIn(site.dist)
  expect(built.map((page) => page.path).sort()).toEqual(
    ["/", "/privacy", "/sign-in", "/sign-in/check", "/sign-in/expired", "/terms"].sort(),
  )
  const findings = built.flatMap(({ path, html }) => {
    const css = stylesOf(site.dist, html)
    return [
      ...viewportFindings(html),
      ...viewportReachFindings(html),
      ...themeColorFindings(html),
      ...hoverFindings(css),
      ...viewportHeightFindings(html, css),
      ...safeAreaFindings(html, css),
    ].map((finding) => `${path}: ${finding}`)
  })
  expect(findings).toEqual([])
})

test("the page pads its edges with all four safe-area insets", () => {
  const css = stylesOf(site.dist, pagesIn(site.dist).find((page) => page.path === "/")?.html ?? "")
  for (const side of ["top", "right", "bottom", "left"]) expect(css).toContain(`safe-area-inset-${side}`)
})

for (const path of paths) {
  test(`${path} has no sideways scroll at 320, 390 and 844 px wide`, async ({ page }) => {
    for (const size of widths) {
      await page.setViewportSize(size)
      await open(page, path)
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }))
      expect(scrollWidth, `${String(size.width)} px wide`).toBeLessThanOrEqual(clientWidth)
    }
  })

  test(`${path} paints its theme color at the very top`, async ({ page }) => {
    await open(page, path)
    const html = await page.content()
    const meta = themeColorFor(html, "light")
    expect(meta).toBeDefined()
    const painted = await page.evaluate((color) => {
      const probe = document.createElement("span")
      probe.style.color = color ?? ""
      document.body.append(probe)
      const expected = getComputedStyle(probe).color
      probe.remove()
      const transparent = "rgba(0, 0, 0, 0)"
      let found = transparent
      for (
        let node = document.elementFromPoint(1, 1);
        node !== null && found === transparent;
        node = node.parentElement
      ) {
        found = getComputedStyle(node).backgroundColor
      }
      return { expected, found }
    }, meta)
    expect(painted.found).toBe(painted.expected)
  })
}

test("the ticker label clears a landscape notch", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 })
  const client = await page.context().newCDPSession(page)
  await client.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 0, right: 47, bottom: 21, left: 47 } })
  await open(page, "/")
  const label = page.getByText("GOOD DECK", { exact: true })
  const textLeft = await label.evaluate((element) => {
    const range = document.createRange()
    range.selectNodeContents(element)
    return range.getBoundingClientRect().left
  })
  expect(textLeft).toBeGreaterThanOrEqual(47)
  expect((await label.boundingBox())?.x).toBe(0)
})

test("every link and button on the landing page and the sign-in pages is at least 44 by 44 px", async ({ page }) => {
  for (const path of ["/", "/sign-in", "/sign-in/check", "/sign-in/expired"]) {
    await open(page, path)
    const small = await page.evaluate(() =>
      [...document.querySelectorAll("a, button")].flatMap((element) => {
        const box = element.getBoundingClientRect()
        if (box.width === 0 && box.height === 0) return []
        return box.width < 44 || box.height < 44
          ? [
              `${(element.textContent ?? "").trim().slice(0, 30)} ${String(Math.round(box.width))}x${String(Math.round(box.height))}`,
            ]
          : []
      }),
    )
    expect(small, path).toEqual([])
  }
})

test("the header and the hero keep their links 44 px tall at 320 px too", async ({ page }) => {
  await page.setViewportSize(widths[0] ?? phone)
  await open(page, "/")
  const small = await page.evaluate(() =>
    [
      ...document.querySelectorAll(
        "header a, header button, main > section:first-child a, main > section:first-child button",
      ),
    ].flatMap((element) => {
      const box = element.getBoundingClientRect()
      if (box.width === 0 && box.height === 0) return []
      return box.height < 44 || box.width < 44
        ? [`${(element.textContent ?? "").trim()} ${String(Math.round(box.width))}x${String(Math.round(box.height))}`]
        : []
    }),
  )
  expect(small).toEqual([])
})

test("a field takes 16 px text on a touch screen so the page does not zoom", async ({ page }) => {
  for (const path of ["/sign-in", "/sign-in/check"]) {
    await open(page, path)
    const sizes = await page.evaluate(() =>
      [...document.querySelectorAll("input")].map((input) => parseFloat(getComputedStyle(input).fontSize)),
    )
    expect(sizes.length).toBeGreaterThan(0)
    for (const size of sizes) expect(size, path).toBeGreaterThanOrEqual(16)
  }
})

test("the keyboard says what each field wants", async ({ page }) => {
  await open(page, "/sign-in")
  const email = page.getByLabel("Email")
  await expect(email).toHaveAttribute("type", "email")
  await expect(email).toHaveAttribute("autocapitalize", "none")
  await expect(email).toHaveAttribute("autocorrect", "off")
  await expect(email).toHaveAttribute("enterkeyhint", "go")
  await open(page, "/sign-in/check")
  const code = page.getByLabel("Or enter the 6-digit code")
  await expect(code).toHaveAttribute("inputmode", "numeric")
  await expect(code).toHaveAttribute("autocomplete", "one-time-code")
  await expect(code).toHaveAttribute("autocapitalize", "none")
  await expect(code).toHaveAttribute("enterkeyhint", "done")
})

test("the page takes taps and scrolls like a document", async ({ page }) => {
  await open(page, "/")
  const read = await page.evaluate(() => {
    const style = (selector: string) => getComputedStyle(document.querySelector(selector) as Element)
    return {
      highlight: style("html").getPropertyValue("-webkit-tap-highlight-color"),
      pullToRefresh: style("html").overscrollBehaviorY,
      bodySelect: style("body").userSelect,
      buttonSelect: style("header a").userSelect,
      buttonAction: style("header a").touchAction,
      demoSelect: style("[data-fit-frame]").userSelect,
      demoAction: style("[data-fit-frame]").touchAction,
    }
  })
  expect(read.highlight).toBe("rgba(0, 0, 0, 0)")
  expect(read.pullToRefresh).toBe("auto")
  expect(read.bodySelect).not.toBe("none")
  expect(read.buttonSelect).toBe("none")
  expect(read.buttonAction).toBe("manipulation")
  expect(read.demoSelect).toBe("none")
  expect(read.demoAction).not.toBe("none")
})

test("a finger on the demo scrolls the page past it", async ({ page }) => {
  await open(page, "/")
  const demo = page.locator("[data-fit-frame]").first()
  await demo.scrollIntoViewIfNeeded()
  await page.waitForFunction(() => {
    const at = scrollY
    return new Promise((resolve) => setTimeout(() => resolve(at === scrollY), 100))
  })
  const before = await page.evaluate(() => scrollY)
  const box = await demo.boundingBox()
  expect(box).not.toBeNull()
  const client = await page.context().newCDPSession(page)
  const x = (box?.x ?? 0) + (box?.width ?? 0) / 2
  const y = (box?.y ?? 0) + (box?.height ?? 0) / 2
  await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] })
  for (let step = 1; step <= 10; step += 1) {
    await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y - step * 10 }] })
    await page.waitForTimeout(16)
  }
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before)
})

test("pressing a button moves it, and with reduced motion it does not", async ({ page }) => {
  await open(page, "/sign-in")
  const button = page.getByRole("button", { name: "Continue with email" })
  const pressed = async () => {
    const box = await button.boundingBox()
    await page.mouse.move((box?.x ?? 0) + 20, (box?.y ?? 0) + 10)
    await page.mouse.down()
    await page.waitForTimeout(300)
    const transform = await button.evaluate((element) => getComputedStyle(element).transform)
    await page.mouse.up()
    return transform
  }
  expect(await pressed()).not.toBe("none")
  await page.emulateMedia({ reducedMotion: "reduce" })
  expect(await pressed()).toBe("none")
})
