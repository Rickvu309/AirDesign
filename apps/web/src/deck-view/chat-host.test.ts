import { doomRoutes, viewTools } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import { testTheme } from "@airdesign/doom/testing"
import { describe, expect, it } from "vitest"
import { connectChatHost, modelContextOf, type HostLine } from "./chat-host"
import { chatDoomRemote } from "./chat-remote"

type Sent = { readonly jsonrpc: "2.0"; readonly id?: number; readonly method?: string; readonly params?: unknown }

function fakeHost(answer: (sent: Sent) => unknown) {
  const sent: Sent[] = []
  let heard: (message: never) => void = () => undefined
  const line: HostLine = {
    post: (message) => {
      const each = message as Sent
      sent.push(each)
      if (each.id !== undefined && each.method !== undefined)
        queueMicrotask(() => heard({ jsonrpc: "2.0", id: each.id, result: answer(each) } as never))
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
    chat.onShown((each) => shown.push(each?.deck ?? null))
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
    const late: (string | null)[] = []
    chat.onShown((each) => late.push(each?.deck ?? null))
    expect(late).toEqual(["d5"])
  })

  it("opens on the slide the agent took a screenshot of", async () => {
    const host = fakeHost(() => ({}))
    const chat = await connectChatHost(host.line)
    const shown: unknown[] = []
    chat.onShown((each) => shown.push(each))
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
    const chat = await connectChatHost(host.line)
    chat.tellModel({ deck: "d1", slide: "s1", slideNumber: 1, selected: [] })
    chat.tellModel({ deck: "d1", slide: "s1", slideNumber: 1, selected: [] })
    chat.tellModel({ deck: "d1", slide: "s1", slideNumber: 1, selected: ["n5"] })
    const told = host.sent.filter((each) => each.method === "ui/update-model-context")
    expect(told.map((each) => each.params)).toEqual([
      modelContextOf({ deck: "d1", slide: "s1", slideNumber: 1, selected: [] }),
      modelContextOf({ deck: "d1", slide: "s1", slideNumber: 1, selected: ["n5"] }),
    ])
    expect(told.every((each) => typeof each.id === "number")).toBe(true)
  })

  it("keeps the selection to itself when the chat takes no model context", async () => {
    const host = fakeHost(() => ({ hostCapabilities: {} }))
    const chat = await connectChatHost(host.line)
    chat.tellModel({ deck: "d1", slide: "s1", slideNumber: 1, selected: ["n5"] })
    expect(host.sent.map((each) => each.method)).toEqual(["ui/initialize", "ui/notifications/initialized"])
  })

  it("answers the chat's requests so it can tear the view down", async () => {
    const host = fakeHost(() => ({}))
    await connectChatHost(host.line)
    host.tell("ui/resource-teardown", { reason: "closed" }, 7)
    expect(host.sent.at(-1)).toEqual({ jsonrpc: "2.0", id: 7, result: {} })
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

  it("lets go of a held wait when the view stops following", async () => {
    const host = fakeHost(() => ({}))
    const line: HostLine = {
      post: (message) => {
        const each = message as Sent
        if (each.method === "tools/call") return
        host.line.post(message)
      },
      listen: host.line.listen,
    }
    const remote = chatDoomRemote(await connectChatHost(line))
    const stop = new AbortController()
    const held = remote.since({ deck: "d1", rev: 1, wait: true }, stop.signal)
    stop.abort()
    await expect(held).rejects.toThrow()
  })
})
