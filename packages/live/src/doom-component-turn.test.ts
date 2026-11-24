import * as doom from "@airdesign/doom"
import { afterEach, beforeEach, expect, it } from "vitest"
import { installIndexedDb } from "./browser-fixtures.js"
import { deleteDatabase } from "./device.js"
import { barFor, data, frame, measure, person, placed, two } from "./doom-component-fixtures.js"

beforeEach(installIndexedDb)
afterEach(deleteDatabase)

it("undoes and redoes a bar deletion after an agent restyles a category", async () => {
  const { deck, shared } = await placed()
  expect(deck.regenerate(frame, { data: two }).ok).toBe(true)
  await deck.sync()
  const beta = barFor(deck.view(), "b")
  expect(deck.push([{ node: beta, prop: "parent", value: null }]).ok).toBe(true)
  await deck.sync()
  const now = deck.server()
  const label = doom
    .propOf(now.nodes.get(frame), "instance")!
    .parts.find(({ key }) => key[0] === "category" && key[1] === "a")!.node
  const change = doom.readAgentChange({ op: "set", target: label, textStyle: "body" })
  if (doom.isRefusal(change)) throw new Error(JSON.stringify(change))
  const styled = doom.compileAgentEdit(now, [change], {
    once: "restyle",
    author: { kind: "agent", id: "agent", run: "restyle" },
    phase: "start",
    mint: deck.mint,
  })
  if (doom.isRefusal(styled)) throw new Error(JSON.stringify(styled))
  expect(await shared.edit({ deck: deck.deck, edit: styled.edit })).toMatchObject({ ok: true })
  await deck.catchUp()
  expect(deck.undo()).toMatchObject({ ok: true })
  await deck.sync()
  expect(doom.onDeck(deck.server().nodes, beta)).toBe(true)
  expect(deck.redo()).toMatchObject({ ok: true })
  await deck.sync()
  expect(doom.onDeck(deck.server().nodes, beta)).toBe(false)
  expect(deck.regenerate(frame, { data: data(9) }).ok).toBe(true)
  await deck.sync()
  expect(doom.propOf(deck.server().nodes.get(label), "text")?.style).toBe("body")
  expect(deck.notices()).toEqual([])
})

it("undoes a rebased offline data change back to the other device's data", async () => {
  const { deck, shared, offline } = await placed()
  offline(true)
  expect(deck.regenerate(frame, { data: data(2) }).ok).toBe(true)
  expect(deck.undo()).toMatchObject({ ok: true })
  await deck.sync()

  const changed = doom.regenerateComponent(deck.server(), frame, { data: data(3) }, measure)
  if (doom.isRefusal(changed)) throw new Error(JSON.stringify(changed))
  expect(
    await shared.edit({
      deck: deck.deck,
      edit: { once: "other-data", author: person, readBase: deck.server().rev, writes: changed.writes },
    }),
  ).toMatchObject({ ok: true })

  offline(false)
  await deck.sync()
  expect(doom.propOf(deck.server().nodes.get(frame), "instance")?.data).toEqual(data(3))
  expect(deck.notices()).toEqual([])
})

it("reports a refused rebuild and keeps the undo step available", async () => {
  const { deck, shared } = await placed()
  expect(deck.regenerate(frame, { data: data(4) }).ok).toBe(true)
  await deck.sync()
  const root = deck.server().nodes.get(frame)
  const box = doom.propOf(root, "box")
  const instance = doom.propOf(root, "instance")
  const changeBox = async (once: string, value: unknown) => {
    expect(
      await shared.edit({
        deck: deck.deck,
        edit: {
          once,
          author: person,
          readBase: deck.server().rev,
          writes: [
            { node: frame, prop: "instance", value: instance },
            { node: frame, prop: "box", value },
          ],
        },
      }),
    ).toMatchObject({ ok: true })
    await deck.catchUp()
  }
  await changeBox("break-box", null)
  expect(deck.undo()).toMatchObject({ ok: false, reason: "refused" })
  expect(deck.notices()).toMatchObject([{ turn: "undo" }])
  expect(doom.propOf(deck.view().nodes.get(frame), "instance")?.data).toEqual(data(4))
  await changeBox("restore-box", box)
  expect(deck.undo()).toMatchObject({ ok: true })
  await deck.sync()
  expect(doom.propOf(deck.server().nodes.get(frame), "instance")?.data).toEqual(data(1))
})
