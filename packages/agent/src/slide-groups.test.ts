import * as doom from "@airdesign/doom"
import { expect, it } from "vitest"

import { callTool } from "./index.js"
import { scriptOf } from "./testing/change-script.js"
import { memoryDecks } from "./testing/memory-decks.js"

function slideGroupsIn(layers: string): { group: string; slides: string[] }[] {
  const groups: { group: string; slides: string[] }[] = []
  for (const line of layers.split("\n")) {
    const match = /^slide (\S+) .* group=(\S+)$/.exec(line)
    if (match === null) continue
    const [, id, group] = match
    const last = groups.at(-1)
    if (last !== undefined && last.group === group) last.slides.push(id!)
    else groups.push({ group: group!, slides: [id!] })
  }
  return groups
}

it("saves and refuses slide group edits through the existing tool, using its answer fields alone", async () => {
  const host = memoryDecks(
    () => doom.doomFromTree({ theme: doom.defaultTheme, slides: [{ name: "Title", children: [] }] }).doom,
  )
  let minted = 0
  const session = { agent: "aira", mint: () => `minted${String(++minted)}` }
  const call = async (tool: string, args: Record<string, unknown>) =>
    (await callTool(`airdesign_${tool}`, args, session, host)).fields
  const made = await call("execute", { script: "createDeck()" })
  expect(made).toMatchObject({ ok: true, deck: expect.any(String) })
  if (typeof made !== "object" || made === null || !("deck" in made) || typeof made.deck !== "string")
    throw new Error("createDeck returned no deck id")
  const { deck } = made
  const read = async () => {
    const saved = (await call("execute", { deck, script: "get()" })) as { ok: boolean; result: unknown }
    expect(saved).toMatchObject({ ok: true })
    return saved.result as { rev: number; layers: string }
  }
  const edit = async (body: Record<string, unknown>) =>
    call("execute", { deck, script: scriptOf([{ op: "slide", ...body }]) })
  const groups = async () => slideGroupsIn((await read()).layers)

  const [first] = await groups()
  expect(first?.group).toMatch(/\w+:\d+/)
  expect(await edit({ add: { group: "new", after: first!.group } })).toMatchObject({ ok: true })
  const second = (await groups())[1]!
  expect(await edit({ add: { group: "new", after: second.group } })).toMatchObject({ ok: true })
  const third = (await groups())[2]!
  expect(await edit({ move: { group: third.group, before: first!.group } })).toMatchObject({ ok: true })
  expect(await groups()).toEqual([third, first, second])
  expect(await edit({ move: { slide: first!.slides[0], group: second.group, after: null } })).toMatchObject({
    ok: true,
  })
  expect(await groups()).toEqual([third, { ...second, slides: [...first!.slides, ...second.slides] }])
  const fold = [...host.decks.values()][0]!
  expect(doom.childrenOf(fold, doom.nodeId(first!.group))).toEqual([])
  expect(doom.parentOf(fold.nodes.get(doom.nodeId(first!.group)))).toMatchObject({ id: expect.any(String) })

  const before = await read()
  expect(await edit({ move: { group: "missing:1", before: second.group } })).toMatchObject({
    ok: false,
    refusal: "dead",
    field: "target",
    node: "missing:1",
    note: expect.stringContaining("get() lists the ids"),
  })
  expect(await read()).toEqual(before)
})
