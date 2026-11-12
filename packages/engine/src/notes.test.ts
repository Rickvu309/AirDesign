import { expect, it } from "vitest"
import { currentValue, elementId, orderKeyBetween } from "@airdesign/document"
import { readDeckId } from "@airdesign/catalog"
import { call, openDeck } from "./index.js"

it("uses the same catalog and engine edit path for person and agent notes", () => {
  const id = readDeckId("notes-deck")
  if (!id.ok) throw new Error("deck")
  const node = elementId("256.notes")
  const person = call(
    "commit_edits",
    openDeck(id.deck),
    { actor: "person" },
    { deck: id.deck, once: "notes-1", batch: [{ node, floor: "Imported notes", value: "Person notes" }] },
  )
  expect(person.ok).toBe(true)
  if (!person.ok) return
  expect(currentValue(person.deck.register.elements[node]!)).toBe("Person notes")
  const caller = { actor: "agent", runId: "notes-run" } as const
  const started = call("start_run", person.deck, caller, { deck: id.deck, runId: caller.runId, elements: [{ node }] })
  expect(started.ok).toBe(true)
  if (!started.ok) return
  const agent = call("edit_deck", started.deck, caller, {
    deck: id.deck,
    base: started.deck.revision,
    changes: [{ node, value: "Agent notes", readAt: 1 }],
  })
  expect(agent.ok).toBe(true)
  if (!agent.ok) return
  expect(currentValue(agent.deck.register.elements[node]!)).toBe("Agent notes")
})

it("edits notes on a deck indexed before notes were included", () => {
  const id = readDeckId("older-deck")
  if (!id.ok) throw new Error("deck")
  const opened = openDeck(id.deck)
  const deck = {
    ...opened,
    register: {
      ...opened.register,
      index: { total: 0, elements: [], slides: [{ id: "256", position: 0 }], pages: [] },
    },
  }
  const node = elementId("256.notes")
  const edited = call(
    "commit_edits",
    deck,
    { actor: "person" },
    { deck: id.deck, batch: [{ node, floor: "Older notes", value: "Updated notes" }] },
  )
  expect(edited.ok).toBe(true)
  if (edited.ok) expect(currentValue(edited.deck.register.elements[node]!)).toBe("Updated notes")
})

it("lets a person write the first note on a slide they added", () => {
  const id = readDeckId("added-deck")
  if (!id.ok) throw new Error("deck")
  const opened = openDeck(id.deck)
  const deck = {
    ...opened,
    register: {
      ...opened.register,
      index: { total: 0, elements: [], slides: [{ id: "256", position: 0 }], pages: [] },
    },
  }
  const added = call(
    "commit_edits",
    deck,
    { actor: "person" },
    {
      deck: id.deck,
      batch: [
        { slide: "add", id: "258", after: "256", key: orderKeyBetween(null, null), layout: "256", file: ["256"] },
      ],
    },
  )
  if (!added.ok) throw new Error(added.refusal)
  const node = elementId("258.notes")
  const edited = call(
    "commit_edits",
    added.deck,
    { actor: "person" },
    { deck: id.deck, batch: [{ node, floor: "", value: "First note" }] },
  )
  expect(edited.ok).toBe(true)
  if (edited.ok) expect(currentValue(edited.deck.register.elements[node]!)).toBe("First note")
})
