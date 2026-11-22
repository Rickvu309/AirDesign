import { readDeckId, type FindingsReport } from "@airdesign/catalog"
import { elementId } from "@airdesign/document"
import { expect, it } from "vitest"
import { DeckFindings, keptDecks } from "./deck-findings.js"

function deck(name: string) {
  const parsed = readDeckId(name)
  if (!parsed.ok) throw new Error(parsed.refusal)
  return parsed.deck
}

const findings = [{ code: "overflow", node: elementId("256.2"), needed: 80, room: 60, size: 24, height: 87.2 }] as const

function report(name: string, revision: number): FindingsReport {
  return { deck: deck(name), revision, findings }
}

it("keeps the newest report per deck and never goes back to an older revision", () => {
  const findings = new DeckFindings()
  expect(findings.latest(deck("deck"))).toBeUndefined()
  findings.keep(report("deck", 3))
  findings.keep(report("deck", 2))
  expect(findings.latest(deck("deck"))?.revision).toBe(3)
  const again = { ...report("deck", 3), findings: [] }
  findings.keep(again)
  expect(findings.latest(deck("deck"))).toBe(again)
  findings.keep(report("deck", 4))
  expect(findings.latest(deck("deck"))?.revision).toBe(4)
  expect(findings.latest(deck("other"))).toBeUndefined()
})

it("forgets the deck reported longest ago once it holds more decks than it keeps", () => {
  const findings = new DeckFindings()
  for (let at = 0; at <= keptDecks; at += 1) findings.keep(report(`deck-${String(at)}`, 1))
  expect(findings.latest(deck("deck-0"))).toBeUndefined()
  expect(findings.latest(deck("deck-1"))?.revision).toBe(1)
  expect(findings.latest(deck(`deck-${String(keptDecks)}`))?.revision).toBe(1)
})

it("wakes a wait when its deck gets a report, and on abort", async () => {
  const findings = new DeckFindings()
  const watching = new AbortController()
  let woken = false
  const waiting = findings.wait(deck("deck"), watching.signal).then(() => {
    woken = true
  })
  findings.keep(report("other", 1))
  await Promise.resolve()
  expect(woken).toBe(false)
  findings.keep(report("deck", 1))
  await waiting
  expect(woken).toBe(true)
  const stopping = new AbortController()
  const stopped = findings.wait(deck("deck"), stopping.signal)
  stopping.abort()
  await stopped
  const gone = new AbortController()
  gone.abort()
  await findings.wait(deck("deck"), gone.signal)
})
