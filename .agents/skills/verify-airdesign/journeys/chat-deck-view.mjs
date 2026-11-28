import { once } from "node:events"
import { writeFileSync } from "node:fs"
import { createServer } from "node:http"
import { createRequire } from "node:module"
import path from "node:path"
import { expect } from "@playwright/test"
import { chatHostPage, hostLook, strictPolicy } from "../bin/chat-host.mjs"
import { fakeOrigins } from "../bin/site.mjs"
import { verifyImageHost } from "../bin/verify-images.mjs"
import { outsideAgentToken } from "./aira-panel.mjs"

const { deckViewCopy } = createRequire(import.meta.url)("../../../../apps/web/src/copy/deck-view-copy.ts")

const appsHtml = "text/html;profile=mcp-app"
const picture = { x: 1000, y: 240, w: 800, h: 533 }
const bar = { x: 120, y: 640, w: 640, h: 120 }

const slideScript = (slide) => `
insert({ parent: ${JSON.stringify(slide)}, kind: "text", textStyle: "title", text: "Hiking trips grew 40% this year", box: { x: 120, y: 240, w: 760, h: 300 } })
insert({ parent: ${JSON.stringify(slide)}, kind: "picture", name: "Mountains", fill: { image: "https://${verifyImageHost}/picture.png" }, box: ${JSON.stringify(picture)} })
const growth = insert({ parent: ${JSON.stringify(slide)}, kind: "shape", shape: "rect", name: "Growth", fill: "accent1", box: ${JSON.stringify(bar)} })
growth`

function mcpCaller(origin, token) {
  return async (method, params, signal) => {
    const response = await fetch(`${origin}/mcp`, {
      method: "POST",
      signal,
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    })
    const text = await response.text()
    const line = text.startsWith("{")
      ? text
      : text
          .split("\n")
          .find((each) => each.startsWith("data: "))
          ?.slice(6)
    if (line === undefined) throw new Error(`/mcp answered ${String(response.status)} to ${method}: ${text}`)
    return JSON.parse(line)
  }
}

async function listen(server) {
  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  return server.address().port
}

async function body(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  return JSON.parse(Buffer.concat(chunks).toString("utf8"))
}

async function colorAt(page, jpeg, at) {
  return page.evaluate(
    async ({ data, at }) => {
      const image = new Image()
      image.src = `data:image/jpeg;base64,${data}`
      await image.decode()
      const canvas = document.createElement("canvas")
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext("2d")
      context.drawImage(image, 0, 0)
      const [r, g, b] = context.getImageData(
        Math.round(at.x * image.naturalWidth),
        Math.round(at.y * image.naturalHeight),
        1,
        1,
      ).data
      return { r, g, b }
    },
    { data: jpeg, at },
  )
}

const pictureAt = (x, y) => ({ x: (picture.x + picture.w * x) / 1920, y: (picture.y + picture.h * y) / 1080 })

const evalProbe = (violation) => violation.directive === "script-src" && violation.blocked === "eval"

export default async function drive(kit) {
  const { signIn, page, context, capture, note, origin } = kit
  const { cookie } = await signIn()
  const chat = mcpCaller(origin, await outsideAgentToken(kit, cookie, "Chat host"))
  const agent = mcpCaller(origin, await outsideAgentToken(kit, cookie, "Script agent"))
  await context.clearCookies()
  const execute = async (call, args) => {
    const answer = await call("tools/call", { name: "airdesign_execute", arguments: args })
    expect(answer.result?.structuredContent, JSON.stringify(answer)).toMatchObject({ ok: true })
    return answer.result
  }

  const [resource] = (await chat("resources/read", { uri: "ui://airdesign/deck.html" })).result.contents
  expect(resource.mimeType).toBe(appsHtml)
  const ours = (text) => text.replaceAll(fakeOrigins.app, origin)
  const shell = ours(resource.text)
  const csp = resource._meta.ui.csp
  const policy = strictPolicy({
    connectDomains: csp.connectDomains.map(ours),
    resourceDomains: csp.resourceDomains.map(ours),
  })

  const createArgs = { script: 'createDeck({ name: "Trips 2026", style: "consulting" })' }
  const created = await execute(chat, createArgs)
  const { deck } = created.structuredContent
  const shown = { arguments: createArgs, result: created }

  const sandbox = createServer((request, response) => {
    if (request.url !== "/view") return void response.writeHead(404).end()
    response
      .writeHead(200, { "content-type": "text/html; charset=utf-8", "content-security-policy": policy })
      .end(shell)
  })
  const sandboxOrigin = `http://localhost:${String(await listen(sandbox))}`
  const viewCalls = []
  const relayed = []
  const closing = new AbortController()
  const host = createServer(async (request, response) => {
    if (request.method === "POST" && request.url === "/tools-call") {
      const params = await body(request)
      viewCalls.push(params.name)
      const relay = { name: params.name, endedByHost: false }
      relayed.push(relay)
      const ended = new AbortController()
      response.on("close", () => {
        if (response.writableFinished) return
        relay.endedByHost = Date.now()
        ended.abort()
      })
      const answer = await chat("tools/call", params, AbortSignal.any([closing.signal, ended.signal])).catch(
        (error) => ({ jsonrpc: "2.0", error: { code: -32603, message: String(error) } }),
      )
      if (ended.signal.aborted) return
      relay.answered = Date.now()
      return void response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(answer))
    }
    if (request.url !== "/") return void response.writeHead(404).end()
    response
      .writeHead(200, { "content-type": "text/html; charset=utf-8" })
      .end(chatHostPage(`${sandboxOrigin}/view`, shown))
  })
  const hostOrigin = `http://127.0.0.1:${String(await listen(host))}`
  const seenBy = (name) => page.evaluate((name) => window.host[name], name)
  const tell = (name, method, params) =>
    page.evaluate(({ name, method, params }) => window.tell(name, method, params), { name, method, params })
  const ask = (name, method, params) =>
    page.evaluate(({ name, method, params }) => window.ask(name, method, params), { name, method, params })

  const consoled = []
  const faults = []
  let probes = 0
  let faulted
  const fault = new Promise((_, reject) => {
    faulted = reject
  })
  fault.catch(() => undefined)
  const heard = (line) => {
    consoled.push(line)
    const violation = /^error: CSP violation (\{.*\})$/.exec(line)?.[1]
    if (violation !== undefined && evalProbe(JSON.parse(violation))) return void (probes += 1)
    if (!/^(error|pageerror)|Content Security Policy|CSP violation|Refused|CORS|Access-Control/i.test(line)) return
    faults.push(line)
    faulted(new Error(`The chat view logged a fault: ${line}`))
  }
  page.on("console", (message) => heard(`${message.type()}: ${message.text()}`))
  page.on("pageerror", (error) => heard(`pageerror: ${error.message}`))
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) =>
      console.error(
        `CSP violation ${JSON.stringify({ directive: event.effectiveDirective, blocked: event.blockedURI, source: event.sourceFile })}`,
      ),
    )
  })
  const unfaulted = (step) => Promise.race([step, fault])

  let out
  try {
    await page.setViewportSize({ width: 800, height: 900 })
    await page.goto(`${hostOrigin}/`)
    const view = page.frameLocator("#view")
    await unfaulted(expect(view.locator(`[data-deck-view-ready="${deck}"]`)).toBeVisible({ timeout: 30_000 }))
    out = path.dirname(await capture("chat-view-new-deck"))
    expect((await seenBy("view")).init.appCapabilities).toEqual({ availableDisplayModes: ["inline", "fullscreen"] })
    note(
      `A chat host at ${hostOrigin} framed the shell from resources/read, served by ${sandboxOrigin} under ${policy}; the view offered inline and fullscreen, and execute createDeck showed the new deck ${deck}.`,
    )

    const slide = await view.locator("[data-view-slide]").getAttribute("data-view-slide")
    const built = await execute(agent, { deck, script: slideScript(slide) })
    const growth = built.structuredContent.result
    const painted = view.locator(`[data-view-slide="${slide}"]`)
    await unfaulted(
      expect
        .poll(
          () =>
            painted
              .locator("*")
              .evaluateAll(
                (all) =>
                  all.filter((each) => getComputedStyle(each).backgroundImage.startsWith('url("data:image/')).length,
              ),
          { timeout: 30_000, message: "the view paints the picture from a data: URL" },
        )
        .toBe(1),
    )
    await unfaulted(expect(painted).not.toHaveAttribute("data-fonts-pending", { timeout: 30_000 }))
    expect(viewCalls).toContain("airdesign_view_media")
    await capture("chat-view-built")
    note(
      `An outside agent built slide ${slide} with a picture from ${verifyImageHost}; the open view followed, read the picture with airdesign_view_media and painted it from a data: URL.`,
    )

    const root = view.locator("html")
    const chrome = view.locator(`[data-deck-view-ready="${deck}"]`)
    await expect(root).toHaveAttribute("data-host-theme", "light")
    const chromePixels = async () => {
      const box = await chrome.boundingBox()
      return page.screenshot({ clip: { x: box.x + 16, y: box.y + 16, width: box.width - 32, height: box.height - 32 } })
    }
    const lightPixels = await chromePixels()
    await page.evaluate(() => {
      document.body.dataset.theme = "dark"
    })
    await tell("view", "ui/notifications/host-context-changed", { theme: "dark", styles: { variables: hostLook } })
    await expect(root).toHaveAttribute("data-host-theme", "dark")
    const arrived = await root.evaluate(
      (element, names) => Object.fromEntries(names.map((name) => [name, element.style.getPropertyValue(name)])),
      Object.keys(hostLook),
    )
    expect(arrived).toEqual(hostLook)
    expect((await chromePixels()).equals(lightPixels), "host variables leave the chrome as it was").toBe(true)
    await capture("chat-view-dark")
    await page.evaluate(() => {
      delete document.body.dataset.theme
    })
    await tell("view", "ui/notifications/host-context-changed", { theme: "light" })
    await expect(root).toHaveAttribute("data-host-theme", "light")
    note(
      `The chat switched to dark: the view's root took data-host-theme="dark" and the host's ${String(Object.keys(hostLook).length)} style variables, its chrome pixel for pixel as in light, then went back to light.`,
    )

    const inline = await painted.boundingBox()
    await page.evaluate(() => {
      document.getElementById("view").style.width = "300px"
    })
    await expect.poll(async () => (await painted.boundingBox()).width).toBeLessThan(300)
    await expect.poll(async () => (await seenBy("view")).sizes.at(-1)?.width).toBe(300)
    await capture("chat-view-narrow")
    await page.evaluate(() => {
      document.getElementById("view").style.width = "736px"
    })
    await expect.poll(async () => (await painted.boundingBox()).width).toBe(inline.width)

    const sized = (await seenBy("view")).sizes
    await tell("view", "ui/notifications/host-context-changed", { displayMode: "fullscreen" })
    await ask("view", "ping", {})
    await page.evaluate(() => {
      Object.assign(document.getElementById("view").style, { width: "760px", height: "820px" })
    })
    await expect.poll(async () => (await painted.boundingBox()).width).toBeGreaterThan(inline.width)
    expect((await seenBy("view")).sizes).toEqual(sized)
    await tell("view", "ui/notifications/host-context-changed", { displayMode: "inline" })
    await page.evaluate(() => {
      document.getElementById("view").style.width = "736px"
    })
    await expect.poll(async () => (await seenBy("view")).sizes.length).toBeGreaterThan(sized.length)
    await expect.poll(async () => (await painted.boundingBox()).width).toBe(inline.width)
    expect((await seenBy("view")).sizes.at(-1)).toEqual(sized.at(-1))
    note(
      `In fullscreen the view sent no size of its own; back inline it asked again for ${String(sized.at(-1).height)} px.`,
    )

    const shot = await execute(agent, { deck, script: `screenshot({ target: ${JSON.stringify(slide)} })` })
    expect(shot.structuredContent.screenshots).toEqual([slide])
    const images = shot.content.filter((block) => block.type === "image")
    expect(images).toHaveLength(1)
    expect(viewCalls).toContain("airdesign_view_screenshots")
    writeFileSync(path.join(out, "screenshot-the-agent-received.jpg"), Buffer.from(images[0].data, "base64"))
    const sky = await colorAt(page, images[0].data, pictureAt(0.1, 0.1))
    const sun = await colorAt(page, images[0].data, pictureAt(0.75, 0.28))
    expect(sky.b, `sky ${JSON.stringify(sky)}`).toBeGreaterThan(150)
    expect(sky.r, `sky ${JSON.stringify(sky)}`).toBeLessThan(80)
    expect(sun.r, `sun ${JSON.stringify(sun)}`).toBeGreaterThan(200)
    expect(sun.b, `sun ${JSON.stringify(sun)}`).toBeLessThan(80)
    note(
      `The agent's screenshot() was answered by the chat view with one ${String(Math.round((images[0].data.length * 3) / 4 / 1024))} KB JPEG of the slide; its picture's sky reads rgb(${String(sky.r)},${String(sky.g)},${String(sky.b)}) and sun rgb(${String(sun.r)},${String(sun.g)},${String(sun.b)}).`,
    )

    const scale = inline.width / 1920
    const onBar = { position: { x: (bar.x + bar.w / 2) * scale, y: (bar.y + bar.h / 2) * scale } }
    await painted.click(onBar)
    await expect(view.locator(`[data-view-selected="${growth}"]`)).toBeVisible()
    await expect
      .poll(async () => (await seenBy("view")).contexts)
      .toEqual([
        {
          content: [
            {
              type: "text",
              text: `In the AirDesign deck view the person is on slide 1 (${slide}) of deck ${deck} and has selected layer ${growth}.`,
            },
          ],
          structuredContent: { deck, slide, slideNumber: 1, selected: [growth] },
        },
      ])
    await capture("chat-view-selected")
    note(`A click on the Growth bar selected layer ${growth} and sent ui/update-model-context with it.`)

    await view.getByRole("link", { name: deckViewCopy.openInAirDesign }).click()
    await expect.poll(async () => (await seenBy("view")).opened).toEqual([`${origin}/s/${deck}`])
    const sizes = (await seenBy("view")).sizes
    expect(sizes.at(-1)?.height).toBeGreaterThan(0)
    note(
      `Open in AirDesign sent ui/open-link with ${origin}/s/${deck}; the view sized its frame ${String(sizes.length)} times, last to ${String(sizes.at(-1).height)} px.`,
    )

    await page.evaluate(() => window.frameView("plain", { takesContext: false }))
    const plain = page.frameLocator("#plain")
    const plainSlide = plain.locator(`[data-view-slide="${slide}"]`)
    await unfaulted(expect(plainSlide).toBeVisible({ timeout: 30_000 }))
    await plainSlide.click(onBar)
    await plain.getByRole("link", { name: deckViewCopy.openInAirDesign }).click()
    await expect.poll(async () => (await seenBy("plain")).opened).toEqual([`${origin}/s/${deck}`])
    await expect(plain.locator("[data-view-selected]")).toHaveCount(0)
    expect((await seenBy("plain")).heard).not.toContain("ui/update-model-context")
    note("In a chat without updateModelContext the same click selected nothing and sent no ui/update-model-context.")

    await page.evaluate(() => window.frameView("streamed", { streams: true }))
    await expect.poll(async () => (await seenBy("streamed"))?.heard).toContain("ui/notifications/initialized")
    await tell("streamed", "ui/notifications/tool-input-partial", { arguments: { deck, script: "get(" } })
    const streamed = page.frameLocator("#streamed")
    await unfaulted(expect(streamed.locator(`[data-deck-view-ready="${deck}"]`)).toBeVisible({ timeout: 30_000 }))
    await tell("streamed", "ui/notifications/tool-cancelled", { reason: "The person stopped the reply" })
    await ask("streamed", "ping", {})
    await expect(streamed.locator(`[data-deck-view-ready="${deck}"]`)).toBeVisible()
    note(
      `A view framed while the call still streamed opened ${deck} from tool-input-partial alone and kept it after tool-cancelled.`,
    )

    await page.evaluate(() => window.frameView("cancelled", { streams: true }))
    await expect.poll(async () => (await seenBy("cancelled"))?.heard).toContain("ui/notifications/initialized")
    await tell("cancelled", "ui/notifications/tool-input-partial", { arguments: { script: 'createDeck({ name: "Tr' } })
    await tell("cancelled", "ui/notifications/tool-cancelled", { reason: "The person stopped the reply" })
    const cancelled = page.frameLocator("#cancelled")
    await unfaulted(expect(cancelled.getByText(deckViewCopy.noDeck)).toBeVisible())
    await capture("chat-view-cancelled")
    note("A call cancelled before it named a deck left its view on the quiet no-deck line, not an endless opening.")

    const openDeck = async () => {
      const state = await agent("tools/call", { name: "airdesign_get_app_state", arguments: {} })
      expect(state.result.structuredContent).toHaveProperty("openDeck")
      return state.result.structuredContent.openDeck?.deck ?? null
    }
    await expect.poll(openDeck).toBe(deck)
    const tornDown = Date.now()
    const holding = []
    for (const name of ["view", "plain", "streamed", "cancelled"]) {
      const closed = await page.evaluate((name) => window.tearDown(name), name)
      expect(closed.result).toEqual({})
      expect(closed.heard).toEqual([...closed.pending.map(() => "notifications/cancelled"), `answer ${closed.id}`])
      expect(closed.cancelled.toSorted()).toEqual(closed.pending.toSorted())
      holding.push(...closed.pending)
      if (name !== "view") await page.evaluate((name) => document.getElementById(name).remove(), name)
    }
    expect(holding.length).toBeGreaterThanOrEqual(3)
    const endedSince = () => relayed.filter((relay) => relay.name === "airdesign_view_since" && relay.endedByHost)
    await expect.poll(() => endedSince().length).toBeGreaterThanOrEqual(3)
    writeFileSync(path.join(out, "probe-relayed.json"), JSON.stringify({ tornDown, relayed }, null, 2))
    await expect.poll(openDeck, { timeout: 2_000 }).toBeNull()
    note(
      `Every view cancelled its held calls before acknowledging teardown. The host ended ${String(endedSince().length)} waits to /mcp and the server cleared the open deck within two seconds.`,
    )

    expect(faults).toEqual([])
    note(
      `No CSP violation, refusal, CORS line or error while the views loaded, painted, answered, linked and closed; set aside ${String(probes)} eval probe(s) the code caught.`,
    )
  } finally {
    closing.abort()
    if (out !== undefined) writeFileSync(path.join(out, "console.log"), consoled.join("\n"))
    sandbox.closeAllConnections()
    sandbox.close()
    host.closeAllConnections()
    host.close()
  }
}
