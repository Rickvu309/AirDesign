import { once } from "node:events"
import { writeFileSync } from "node:fs"
import { createServer } from "node:http"
import path from "node:path"
import { expect } from "@playwright/test"
import { fakeOrigins } from "../bin/site.mjs"
import { verifyImageHost } from "../bin/verify-images.mjs"
import { outsideAgentToken } from "./aira-panel.mjs"

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

function strictPolicy({ connectDomains, resourceDomains }) {
  const resources = resourceDomains.join(" ")
  return [
    "default-src 'none'",
    "base-uri 'none'",
    `script-src 'unsafe-inline' 'wasm-unsafe-eval' ${resources}`,
    `style-src 'unsafe-inline' ${resources}`,
    `img-src data: ${resources}`,
    `font-src ${resources}`,
    `connect-src ${connectDomains.join(" ")}`,
  ].join("; ")
}

function hostPage(sandbox, call) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Chat host</title>
<style>body { margin: 0; padding: 24px; font: 14px system-ui } iframe { display: block; width: 736px; height: 400px; border: 1px solid #ddd; border-radius: 12px }</style>
</head><body>
<iframe id="view" sandbox="allow-scripts allow-same-origin" src="${sandbox}/view"></iframe>
<script>
const call = ${JSON.stringify(call)}
const frame = document.getElementById("view")
window.host = { opened: [], contexts: [], sizes: [] }
const send = (message) => frame.contentWindow.postMessage(message, "*")
window.addEventListener("message", async (event) => {
  if (event.source !== frame.contentWindow) return
  const message = event.data
  if (message.method === "ui/initialize")
    send({ jsonrpc: "2.0", id: message.id, result: {
      protocolVersion: "2026-01-26",
      hostInfo: { name: "chat-host", version: "1.0.0" },
      hostCapabilities: { openLinks: {}, serverTools: {}, updateModelContext: { text: {} } },
      hostContext: { displayMode: "inline", availableDisplayModes: ["inline"] },
    } })
  else if (message.method === "ui/notifications/initialized") {
    send({ jsonrpc: "2.0", method: "ui/notifications/tool-input", params: { arguments: call.arguments } })
    send({ jsonrpc: "2.0", method: "ui/notifications/tool-result", params: call.result })
  } else if (message.method === "tools/call") {
    const answer = await (await fetch("/tools-call", { method: "POST", body: JSON.stringify(message.params) })).json()
    send({ ...answer, id: message.id })
  } else if (message.method === "ui/open-link") {
    window.host.opened.push(message.params.url)
    send({ jsonrpc: "2.0", id: message.id, result: {} })
  } else if (message.method === "ui/update-model-context") {
    window.host.contexts.push(message.params)
    send({ jsonrpc: "2.0", id: message.id, result: {} })
  } else if (message.method === "ui/notifications/size-changed") {
    window.host.sizes.push(message.params)
    frame.style.height = message.params.height + "px"
  }
})
</script>
</body></html>`
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
  const agent = mcpCaller(origin, await outsideAgentToken(kit, cookie, "Claude Code"))
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
  const closing = new AbortController()
  const host = createServer(async (request, response) => {
    if (request.method === "POST" && request.url === "/tools-call") {
      const params = await body(request)
      viewCalls.push(params.name)
      const answer = await chat("tools/call", params, closing.signal).catch((error) => ({
        jsonrpc: "2.0",
        error: { code: -32603, message: String(error) },
      }))
      return void response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(answer))
    }
    if (request.url !== "/") return void response.writeHead(404).end()
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(hostPage(sandboxOrigin, shown))
  })
  const hostOrigin = `http://127.0.0.1:${String(await listen(host))}`

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
    note(
      `A chat host at ${hostOrigin} framed the shell from resources/read, served by ${sandboxOrigin} under ${policy}; execute createDeck showed the new deck ${deck}.`,
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

    const shownBox = await painted.boundingBox()
    const scale = shownBox.width / 1920
    await painted.click({ position: { x: (bar.x + bar.w / 2) * scale, y: (bar.y + bar.h / 2) * scale } })
    await expect(view.locator(`[data-view-selected="${growth}"]`)).toBeVisible()
    await expect
      .poll(() => page.evaluate(() => window.host.contexts))
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

    await view.getByRole("link", { name: "Open in AirDesign" }).click()
    await expect.poll(() => page.evaluate(() => window.host.opened)).toEqual([`${origin}/s/${deck}`])
    const sizes = await page.evaluate(() => window.host.sizes)
    expect(sizes.at(-1)?.height).toBeGreaterThan(0)
    note(
      `Open in AirDesign sent ui/open-link with ${origin}/s/${deck}; the view sized its frame ${String(sizes.length)} times, last to ${String(sizes.at(-1).height)} px.`,
    )

    expect(faults).toEqual([])
    note(
      `No CSP violation, refusal, CORS line or error while the view loaded, painted, answered and linked; set aside ${String(probes)} eval probe(s) the code caught.`,
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
