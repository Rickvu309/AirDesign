import { doomRoutes, viewTools } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import { testTheme } from "@airdesign/doom/testing"
import { describe, expect, it } from "vitest"
import { connectChatHost, modelContextOf, type HostLine } from "./chat-host"
import { chatAssets, chatDoomRemote } from "./chat-remote"

type Sent = { readonly jsonrpc: "2.0"; readonly id?: number; readonly method?: string; readonly params?: unknown }

const unanswered = Symbol("unanswered")

function fakeHost(answer: (sent: Sent) => unknown) {
  const sent: Sent[] = []
  let heard: (message: never) => void = () => undefined
  const line: HostLine = {
    post: (message) => {
      const each = message as Sent
      sent.push(each)
      const result = each.id !== undefined && each.method !== undefined ? answer(each) : unanswered
      if (result !== unanswered) queueMicrotask(() => heard({ jsonrpc: "2.0", id: each.id, result } as never))
    },
    listen: (listener) => {
      heard = listener as never
      return () => undefined
    },
  }
  const tell = (method: string, params: unknown, id?: number) =>
    heard({ jsonrpc: "2.0", method, params, ...(id === undefined ? {} : { id }) } as never)
  return { line, sent, tell }
}

const foldWire = (fold: doom.Doom): unknown =>
  JSON.parse(
    JSON.stringify({
      rev: fold.rev,
      nodes: Object.fromEntries(fold.nodes),
      revs: Object.fromEntries([...fold.revs].map(([node, revs]) => [node, doom.revsToJson(revs)])),
      onces: Object.fromEntries(fold.onces),
      runs: doom.runsToJson(fold.runs),
    }),
  )

const darkVariables = {
  "--color-background-primary": "light-dark(white, black)",
  "--color-text-primary": "light-dark(black, white)",
}

describe("the deck view's line to the chat that shows it", () => {
  it("opens with the MCP Apps handshake before anything else", async () => {
    const host = fakeHost(() => ({ protocolVersion: "2026-01-26", hostCapabilities: {}, hostContext: {} }))
    await connectChatHost(host.line)
    expect(host.sent.map((each) => each.method)).toEqual(["ui/initialize", "ui/notifications/initialized"])
    expect(host.sent[0]?.params).toMatchObject({
      protocolVersion: "2026-01-26",
      appInfo: { name: "AirDesign" },
      appCapabilities: {},
    })
  })

  it("shows the deck an agent's call names, from its input or its answer", async () => {
    const host = fakeHost(() => ({}))
    const chat = await connectChatHost(host.line)
    const shown: (string | null)[] = []
    chat.subscribe(() => shown.push(chat.state().shown?.deck ?? null))
    host.tell("ui/notifications/tool-input", { arguments: { deck: "d1", script: "get()" } })
    host.tell("ui/notifications/tool-result", { content: [], structuredContent: { ok: true, deck: "d1", rev: 3 } })
    host.tell("ui/notifications/tool-input", { arguments: { script: 'createDeck({ name: "Q3" })' } })
    host.tell("ui/notifications/tool-result", { content: [], structuredContent: { ok: true, deck: "d2", rev: 1 } })
    host.tell("ui/notifications/tool-result", {
      content: [],
      structuredContent: { ok: true, decks: [{ deck: "d4" }], openDeck: { deck: "d3" } },
    })
    host.tell("ui/notifications/tool-result", { content: [], structuredContent: { ok: true, decks: [{ deck: "d4" }] } })
    host.tell("ui/notifications/tool-result", { content: [], structuredContent: { ok: true, decks: [] } })
    host.tell("ui/notifications/tool-input", { arguments: { deck: "d5", script: "throw 1" } })
    host.tell("ui/notifications/tool-result", { content: [], structuredContent: { ok: false, refusal: "script" } })
    expect(shown).toEqual(["d1", "d1", "d2", "d3", "d4", null, "d5", "d5"])
    expect(chat.state().shown).toEqual({ deck: "d5" })
  })

  it("opens on the slide the agent took a screenshot of", async () => {
    const host = fakeHost(() => ({}))
    const chat = await connectChatHost(host.line)
    const shown: unknown[] = []
    chat.subscribe(() => shown.push(chat.state().shown))
    host.tell("ui/notifications/tool-input", { arguments: { deck: "d1", script: "screenshot()" } })
    host.tell("ui/notifications/tool-result", {
      content: [],
      structuredContent: { ok: true, deck: "d1", rev: 4, screenshots: ["s2", "s3"] },
    })
    expect(shown).toEqual([{ deck: "d1" }, { deck: "d1", slide: "s2" }])
  })

  it("words the slide in view and the person's selection for the model", () => {
    expect(modelContextOf({ deck: "d1", slide: "s2", slideNumber: 3, selected: [] })).toEqual({
      content: [{ type: "text", text: "In the AirDesign deck view the person is on slide 3 (s2) of deck d1." }],
      structuredContent: { deck: "d1", slide: "s2", slideNumber: 3, selected: [] },
    })
    expect(modelContextOf({ deck: "d1", slide: "s2", slideNumber: 3, selected: ["n5"] }).content).toEqual([
      {
        type: "text",
        text: "In the AirDesign deck view the person is on slide 3 (s2) of deck d1 and has selected layer n5.",
      },
    ])
    expect(modelContextOf({ deck: "d1", slide: "s2", slideNumber: 3, selected: ["n5", "n7"] }).content).toEqual([
      {
        type: "text",
        text: "In the AirDesign deck view the person is on slide 3 (s2) of deck d1 and has selected layers n5, n7.",
      },
    ])
  })

  it("tells the model what the person picked, once per change, when the chat takes context", async () => {
    const host = fakeHost((sent) =>
      sent.method === "ui/initialize" ? { hostCapabilities: { updateModelContext: { text: {} } } } : {},
    )
    const { tellModel } = await connectChatHost(host.line)
    tellModel?.({ deck: "d1", slide: "s1", slideNumber: 1, selected: [] })
    tellModel?.({ deck: "d1", slide: "s1", slideNumber: 1, selected: [] })
    tellModel?.({ deck: "d1", slide: "s1", slideNumber: 1, selected: ["n5"] })
    const told = host.sent.filter((each) => each.method === "ui/update-model-context")
    expect(told.map((each) => each.params)).toEqual([
      modelContextOf({ deck: "d1", slide: "s1", slideNumber: 1, selected: [] }),
      modelContextOf({ deck: "d1", slide: "s1", slideNumber: 1, selected: ["n5"] }),
    ])
    expect(told.every((each) => typeof each.id === "number")).toBe(true)
  })

  it("offers no way to tell the model when the chat takes no model context", async () => {
    const host = fakeHost(() => ({ hostCapabilities: {} }))
    const chat = await connectChatHost(host.line)
    expect(chat.tellModel).toBeUndefined()
  })

  it("offers inline and fullscreen, and reads the chat's look, mode and room from the handshake", async () => {
    const host = fakeHost(() => ({
      protocolVersion: "2026-01-26",
      hostCapabilities: {},
      hostContext: {
        theme: "dark",
        styles: { variables: { ...darkVariables, color: "red", "--font-sans": 3 } },
        displayMode: "inline",
        availableDisplayModes: ["inline", "fullscreen", "theatre"],
        containerDimensions: { width: 736, maxHeight: 600 },
        safeAreaInsets: { top: 0, right: 0, bottom: 34, left: 0 },
        locale: "en-US",
      },
    }))
    const chat = await connectChatHost(host.line)
    expect(host.sent[0]?.params).toMatchObject({ appCapabilities: { availableDisplayModes: ["inline", "fullscreen"] } })
    expect(chat.state().context).toEqual({
      theme: "dark",
      styles: { variables: darkVariables },
      displayMode: "inline",
      availableDisplayModes: ["inline", "fullscreen"],
      containerDimensions: { width: 736, maxHeight: 600 },
      safeAreaInsets: { top: 0, right: 0, bottom: 34, left: 0 },
    })
  })

  it("merges each change of the chat's context into what it knows and tells the view", async () => {
    const host = fakeHost(() => ({ hostContext: { theme: "light", displayMode: "inline" } }))
    const chat = await connectChatHost(host.line)
    let told = 0
    chat.subscribe(() => (told += 1))
    host.tell("ui/notifications/host-context-changed", { theme: "dark", styles: { variables: darkVariables } })
    host.tell("ui/notifications/host-context-changed", { theme: "dusk", safeAreaInsets: { top: "1" } })
    expect(told).toBeGreaterThan(0)
    expect(chat.state().context).toEqual({ theme: "dark", styles: { variables: darkVariables }, displayMode: "inline" })
  })

  it("asks for fullscreen only when the chat offers it, and keeps the mode the chat answers", async () => {
    const host = fakeHost((sent) => {
      if (sent.method === "ui/initialize")
        return { hostContext: { displayMode: "inline", availableDisplayModes: ["inline"] } }
      return sent.method === "ui/request-display-mode" ? { mode: "fullscreen" } : {}
    })
    const chat = await connectChatHost(host.line)
    expect(await chat.requestDisplayMode("fullscreen")).toBe("inline")
    expect(host.sent.map((each) => each.method)).not.toContain("ui/request-display-mode")
    host.tell("ui/notifications/host-context-changed", { availableDisplayModes: ["inline", "fullscreen"] })
    expect(await chat.requestDisplayMode("fullscreen")).toBe("fullscreen")
    expect(chat.state().context.displayMode).toBe("fullscreen")
    expect(await chat.requestDisplayMode("inline")).toBe("fullscreen")
    expect(chat.state().context.displayMode).toBe("fullscreen")
    expect(host.sent.filter((each) => each.method === "ui/request-display-mode").map((each) => each.params)).toEqual([
      { mode: "fullscreen" },
      { mode: "inline" },
    ])
  })

  it("sizes its frame up to the chat's limit and leaves the height to the chat in fullscreen", async () => {
    const host = fakeHost(() => ({
      hostContext: {
        displayMode: "inline",
        availableDisplayModes: ["inline", "fullscreen"],
        containerDimensions: { maxHeight: 400 },
      },
    }))
    const chat = await connectChatHost(host.line)
    chat.sizeTo({ width: 736, height: 520 })
    chat.sizeTo({ width: 736, height: 300 })
    host.tell("ui/notifications/host-context-changed", { displayMode: "fullscreen" })
    chat.sizeTo({ width: 1470, height: 900 })
    host.tell("ui/notifications/host-context-changed", { displayMode: "inline" })
    host.tell("ui/notifications/host-context-changed", { theme: "dark" })
    host.tell("ui/notifications/host-context-changed", { containerDimensions: { maxHeight: 200 } })
    host.tell("ui/notifications/host-context-changed", { containerDimensions: { height: 500 } })
    chat.sizeTo({ width: 736, height: 520 })
    expect(
      host.sent.filter((each) => each.method === "ui/notifications/size-changed").map((each) => each.params),
    ).toEqual([
      { width: 736, height: 400 },
      { width: 736, height: 300 },
      { width: 736, height: 300 },
      { width: 736, height: 200 },
    ])
  })

  it("follows the deck field in streaming input regardless of argument order", async () => {
    const host = fakeHost(() => ({}))
    const chat = await connectChatHost(host.line)
    const shown: unknown[] = []
    chat.subscribe(() => shown.push(chat.state().shown))
    host.tell("ui/notifications/tool-input-partial", { arguments: { deck: "d1" } })
    expect(chat.state().shown).toEqual({ deck: "d1" })
    host.tell("ui/notifications/tool-input-partial", { arguments: { script: "get(", deck: "d12" } })
    host.tell("ui/notifications/tool-input-partial", { arguments: { deck: "d12", script: "get()" } })
    host.tell("ui/notifications/tool-cancelled", { reason: "The person stopped the reply" })
    expect(shown).toEqual([{ deck: "d1" }, { deck: "d12" }])
  })

  it("stops waiting for a deck when the call is cancelled before it names one", async () => {
    const host = fakeHost(() => ({}))
    const chat = await connectChatHost(host.line)
    host.tell("ui/notifications/tool-input-partial", { arguments: { script: "createDeck({ na" } })
    expect(chat.state().shown).toBeUndefined()
    host.tell("ui/notifications/tool-cancelled", {})
    expect(chat.state().shown).toBeNull()
  })

  it("lets go of every held call before it answers the chat's teardown, and calls nothing after", async () => {
    const host = fakeHost((sent) => (sent.method === "tools/call" ? unanswered : {}))
    const chat = await connectChatHost(host.line)
    const remote = chatDoomRemote(chat)
    const held = remote.since({ deck: "d1", rev: 1, wait: true }, new AbortController().signal)
    const opening = remote.open({ deck: "d1" })
    const calls = host.sent.flatMap((each) => (each.method === "tools/call" ? [each.id] : []))
    host.tell("ui/resource-teardown", { reason: "The chat closed the view" }, 7)
    await expect(held).rejects.toThrow(DOMException)
    await expect(opening).rejects.toThrow(DOMException)
    expect(chat.closed.aborted).toBe(true)
    const answer = host.sent.findIndex((each) => each.id === 7)
    expect(answer).toBe(host.sent.length - 1)
    expect(host.sent[answer]).toEqual({ jsonrpc: "2.0", id: 7, result: {} })
    expect(
      host.sent
        .slice(0, answer)
        .filter((each) => each.method === "notifications/cancelled")
        .map((each) => each.params),
    ).toEqual(expect.arrayContaining(calls.map((requestId) => ({ requestId }))))
    const before = host.sent.length
    chat.sizeTo({ width: 736, height: 300 })
    await expect(chat.callTool(viewTools.open, { deck: "d1" })).rejects.toThrow(DOMException)
    expect(host.sent).toHaveLength(before)
  })

  it("acknowledges teardown during initialization without cancelling the initialize request", async () => {
    const host = fakeHost(() => unanswered)
    const opening = connectChatHost(host.line)
    host.tell("ui/resource-teardown", {}, 7)
    await expect(opening).rejects.toMatchObject({ name: "AbortError" })
    expect(host.sent.slice(1)).toEqual([{ jsonrpc: "2.0", id: 7, result: {} }])
  })

  it("reads, follows and paints the deck through the view's tools", async () => {
    const fold = doom.doomFromTree({ theme: testTheme, slides: [{ name: "Title", children: [] }] }).doom
    const answers: Record<string, unknown> = {
      [viewTools.open]: { ok: true, deck: "d1", rev: fold.rev, fold: foldWire(fold) },
      [viewTools.since]: { ok: true, deck: "d1", rev: fold.rev, edits: [], screenshots: true },
      [viewTools.screenshots]: { ok: true, deck: "d1", missing: [] },
    }
    const host = fakeHost((sent) => {
      const call = sent.params as { name: string }
      return sent.method === "tools/call" ? { content: [], structuredContent: answers[call.name] } : {}
    })
    const remote = chatDoomRemote(await connectChatHost(host.line))
    expect(await remote.open({ deck: "d1" })).toMatchObject({ ok: true, deck: "d1", rev: fold.rev })
    expect(await remote.since({ deck: "d1", rev: fold.rev, wait: true })).toEqual(
      doomRoutes.since.result(answers[viewTools.since]),
    )
    expect(await remote.screenshots?.({ deck: "d1", rev: fold.rev, screenshots: { keys: [], images: [] } })).toEqual({
      ok: true,
      deck: "d1",
      missing: [],
    })
    expect(await remote.edit({ deck: "d1", edit: {} as doom.Edit })).toMatchObject({ ok: false })
    const calls = host.sent.filter((each) => each.method === "tools/call").map((each) => each.params)
    expect(calls).toEqual([
      { name: viewTools.open, arguments: { deck: "d1" } },
      { name: viewTools.since, arguments: { deck: "d1", rev: fold.rev, wait: true } },
      { name: viewTools.screenshots, arguments: { deck: "d1", rev: fold.rev, screenshots: { keys: [], images: [] } } },
    ])
  })

  it("reads the deck's images through the view's media tool as data URLs a chat's CSP allows, leaving out refusals flagged as errors", async () => {
    const held = "a".repeat(64)
    const gone = "b".repeat(64)
    const host = fakeHost((sent) => {
      if (sent.method !== "tools/call") return {}
      const { sha256 } = (sent.params as { arguments: { sha256: string } }).arguments
      return sha256 === held
        ? { content: [], structuredContent: { ok: true, deck: "d1", sha256, data: btoa("image bytes") } }
        : { content: [], structuredContent: { ok: false, refusal: "owner" }, isError: true }
    })
    const assets = chatAssets(await connectChatHost(host.line))
    const found = await assets.read("d1", [held, gone])
    expect([...found.keys()]).toEqual([held])
    expect(new TextDecoder().decode(found.get(held))).toBe("image bytes")
    expect(assets.url(found.get(held)!, "image/png")).toBe(`data:image/png;base64,${btoa("image bytes")}`)
    const calls = host.sent.filter((each) => each.method === "tools/call").map((each) => each.params)
    expect(calls).toEqual([
      { name: viewTools.media, arguments: { deck: "d1", sha256: held } },
      { name: viewTools.media, arguments: { deck: "d1", sha256: gone } },
    ])
  })

  it("asks the chat to end a held wait when the view stops following", async () => {
    const host = fakeHost((sent) => (sent.method === "tools/call" ? unanswered : {}))
    const remote = chatDoomRemote(await connectChatHost(host.line))
    const stop = new AbortController()
    const held = remote.since({ deck: "d1", rev: 1, wait: true }, stop.signal)
    const call = host.sent.at(-1)
    stop.abort()
    await expect(held).rejects.toThrow(DOMException)
    expect(host.sent.at(-1)).toEqual({
      jsonrpc: "2.0",
      method: "notifications/cancelled",
      params: { requestId: call?.id },
    })
  })
})
