import fc from "fast-check"
import { describe, expect, it } from "vitest"
import { oauth, openGrant, type Command, type Grant } from "./index.js"

const principal = "ada@studio"
const deck = "258.7"
const other = "258.8"

function exchanged(who = principal, home = deck): Grant {
  const open = openGrant(who, home)
  const result = oauth(open, { command: "exchange", deck: home })
  expect(result.accepted).toBe(true)
  expect(result.grant.code).toBe("used")
  expect(result.grant.generation).toBe(1)
  expect(result.grant.principal).toBe(who)
  expect(result.grant.deck).toBe(home)
  return result.grant
}

describe("oauth", () => {
  it("a code works once", () => {
    const open = openGrant(principal, deck)
    const wrong = oauth(open, { command: "exchange", deck: other })
    expect(wrong.accepted).toBe(false)
    expect(wrong.grant).toBe(open)
    const first = oauth(open, { command: "exchange", deck })
    expect(first.accepted).toBe(true)
    expect(first.grant.code).toBe("used")
    expect(first.grant.generation).toBe(1)
    const second = oauth(first.grant, { command: "exchange", deck })
    expect(second.accepted).toBe(false)
    expect(second.grant).toBe(first.grant)
    expect(() => oauth(first.grant, { command: "exchange", deck })).not.toThrow()
  })

  it("a rotated refresh token never works again", () => {
    const current = oauth(exchanged(), { command: "rotate", generation: 1 })
    expect(current.accepted).toBe(true)
    expect(current.grant.generation).toBe(2)
    const call = oauth(current.grant, { command: "call", deck, generation: 1 })
    expect(call.accepted).toBe(false)
    expect(call.grant).toBe(current.grant)
    const again = oauth(current.grant, { command: "rotate", generation: 1 })
    expect(again.accepted).toBe(false)
    expect(again.grant.generation).toBe(2)
    expect(again.grant.revoked).toBe(true)
  })

  it("reuse of a rotated token revokes the family", () => {
    const current = oauth(exchanged(), { command: "rotate", generation: 1 })
    expect(current.accepted).toBe(true)
    const reused = oauth(current.grant, { command: "rotate", generation: 1 })
    expect(reused.accepted).toBe(false)
    expect(reused.grant).not.toBe(current.grant)
    expect(reused.grant.revoked).toBe(true)
    expect(reused.grant.principal).toBe(principal)
    expect(reused.grant.generation).toBe(2)
    const later = oauth(reused.grant, { command: "call", deck, generation: 2 })
    expect(later.accepted).toBe(false)
    expect(later.grant).toBe(reused.grant)
  })

  it("after revocation no call and no rotation is accepted", () => {
    const live = exchanged()
    const revoked = oauth(live, { command: "revoke" })
    expect(revoked.accepted).toBe(true)
    expect(revoked.grant.revoked).toBe(true)
    const call = oauth(revoked.grant, { command: "call", deck, generation: 1 })
    expect(call.accepted).toBe(false)
    expect(call.grant).toBe(revoked.grant)
    const rotate = oauth(revoked.grant, { command: "rotate", generation: 1 })
    expect(rotate.accepted).toBe(false)
    expect(rotate.grant).toBe(revoked.grant)
    const again = oauth(revoked.grant, { command: "revoke" })
    expect(again.accepted).toBe(false)
    expect(again.grant).toBe(revoked.grant)
    expect(() => oauth(revoked.grant, { command: "call", deck, generation: 1 })).not.toThrow()
    expect(() => oauth(revoked.grant, { command: "rotate", generation: 1 })).not.toThrow()
  })

  it("the identity is the stored one", () => {
    const grant = exchanged("agent@studio", deck)
    const call = oauth(grant, { command: "call", deck, generation: 1 })
    expect(call.accepted).toBe(true)
    expect(call.grant).toBe(grant)
    expect(call.grant.principal).toBe("agent@studio")
    const person = exchanged(principal, deck)
    expect(person.principal).toBe(principal)
    expect(person.principal).not.toBe(grant.principal)
  })

  it("a token for one deck does not authorize another", () => {
    const open = openGrant(principal, deck)
    const exchange = oauth(open, { command: "exchange", deck: other })
    expect(exchange.accepted).toBe(false)
    expect(exchange.grant).toBe(open)
    const grant = exchanged()
    const call = oauth(grant, { command: "call", deck: other, generation: 1 })
    expect(call.accepted).toBe(false)
    expect(call.grant).toBe(grant)
    const home = oauth(grant, { command: "call", deck, generation: 1 })
    expect(home.accepted).toBe(true)
    expect(home.grant.deck).toBe(deck)
  })

  it("rotates five times in a row and only the newest generation calls", () => {
    let grant = exchanged()
    for (let generation = 1; generation <= 5; generation += 1) {
      const rotated = oauth(grant, { command: "rotate", generation })
      expect(rotated.accepted).toBe(true)
      expect(rotated.grant.generation).toBe(generation + 1)
      grant = rotated.grant
    }
    expect(grant.generation).toBe(6)
    for (let generation = 1; generation <= 5; generation += 1) {
      const call = oauth(grant, { command: "call", deck, generation })
      expect(call.accepted).toBe(false)
      expect(call.grant).toBe(grant)
    }
    const newest = oauth(grant, { command: "call", deck, generation: 6 })
    expect(newest.accepted).toBe(true)
    expect(newest.grant).toBe(grant)
    expect(newest.grant.principal).toBe(principal)
  })

  it("a call with the previous generation fails after a rotation", () => {
    const rotated = oauth(exchanged(), { command: "rotate", generation: 1 })
    expect(rotated.accepted).toBe(true)
    const previous = oauth(rotated.grant, { command: "call", deck, generation: 1 })
    expect(previous.accepted).toBe(false)
    expect(previous.grant).toBe(rotated.grant)
    const current = oauth(rotated.grant, { command: "call", deck, generation: 2 })
    expect(current.accepted).toBe(true)
    expect(current.grant).toBe(rotated.grant)
  })

  it("a rotate with a generation above the current changes nothing", () => {
    const grant = exchanged()
    const above = oauth(grant, { command: "rotate", generation: 2 })
    expect(above.accepted).toBe(false)
    expect(above.grant).toBe(grant)
    const zero = oauth(grant, { command: "rotate", generation: 0 })
    expect(zero.accepted).toBe(false)
    expect(zero.grant).toBe(grant)
  })

  it("a non-integer generation is refused", () => {
    const grant = exchanged()
    for (const generation of [1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = oauth(grant, { command: "rotate", generation })
      expect(result.accepted).toBe(false)
      expect(result.grant).toBe(grant)
      expect(() => oauth(grant, { command: "rotate", generation })).not.toThrow()
    }
  })

  it("a fresh grant accepts no call and no rotation", () => {
    const grant = openGrant(principal, deck)
    expect(grant.principal).toBe(principal)
    expect(grant.deck).toBe(deck)
    expect(grant.code).toBe("open")
    expect(grant.generation).toBe(0)
    expect(grant.revoked).toBe(false)
    for (const generation of [0, 1]) {
      const call = oauth(grant, { command: "call", deck, generation })
      expect(call.accepted).toBe(false)
      expect(call.grant).toBe(grant)
      const rotate = oauth(grant, { command: "rotate", generation })
      expect(rotate.accepted).toBe(false)
      expect(rotate.grant).toBe(grant)
      expect(rotate.grant.revoked).toBe(false)
    }
  })

  it("a rotate with 1.5 at generation 2 is refused and does not revoke", () => {
    const rotated = oauth(exchanged(), { command: "rotate", generation: 1 })
    expect(rotated.accepted).toBe(true)
    expect(rotated.grant.generation).toBe(2)
    const fraction = oauth(rotated.grant, { command: "rotate", generation: 1.5 })
    expect(fraction.accepted).toBe(false)
    expect(fraction.grant).toBe(rotated.grant)
    expect(fraction.grant.revoked).toBe(false)
    expect(fraction.grant.generation).toBe(2)
  })

  it("a call with a non-integer generation is refused", () => {
    const rotated = oauth(exchanged(), { command: "rotate", generation: 1 })
    expect(rotated.grant.generation).toBe(2)
    for (const generation of [1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const call = oauth(rotated.grant, { command: "call", deck, generation })
      expect(call.accepted).toBe(false)
      expect(call.grant).toBe(rotated.grant)
      expect(call.grant.revoked).toBe(false)
      expect(() => oauth(rotated.grant, { command: "call", deck, generation })).not.toThrow()
    }
  })

  it("an unknown command is refused and does not revoke", () => {
    const grant = exchanged()
    const unknown = oauth(grant, { command: "refresh" } as unknown as Command)
    expect(unknown.accepted).toBe(false)
    expect(unknown.grant).toBe(grant)
    expect(unknown.grant.revoked).toBe(false)
    const missing = oauth(grant, {} as unknown as Command)
    expect(missing.accepted).toBe(false)
    expect(missing.grant).toBe(grant)
    expect(missing.grant.revoked).toBe(false)
    const word = oauth(grant, "revoke" as unknown as Command)
    expect(word.accepted).toBe(false)
    expect(word.grant).toBe(grant)
    expect(word.grant.revoked).toBe(false)
    expect(word.grant.code).toBe("used")
  })

  it("a null command is refused and does not throw", () => {
    const grant = exchanged()
    expect(() => oauth(grant, null as unknown as Command)).not.toThrow()
    const result = oauth(grant, null as unknown as Command)
    expect(result.accepted).toBe(false)
    expect(result.grant).toBe(grant)
    expect(result.grant.revoked).toBe(false)
  })

  it("a command that is not an object is refused and does not throw", () => {
    const grant = exchanged()
    for (const word of [undefined, "revoke", 7, true]) {
      expect(() => oauth(grant, word as unknown as Command)).not.toThrow()
      const result = oauth(grant, word as unknown as Command)
      expect(result.accepted).toBe(false)
      expect(result.grant).toBe(grant)
    }
  })

  it("an extra principal key is ignored", () => {
    const grant = exchanged()
    const plain = { command: "call" as const, deck, generation: 1 }
    const extra = { ...plain, principal: "intruder", actor: "intruder" }
    const clean = oauth(grant, plain)
    const dirty = oauth(grant, extra)
    expect(clean.accepted).toBe(true)
    expect(dirty.accepted).toBe(true)
    expect(dirty.grant).toBe(grant)
    expect(dirty.grant.principal).toBe(principal)
    expect(dirty.grant).toEqual(clean.grant)
  })

  it("accepts at most one generation and nothing after revocation", () => {
    const decks = [deck, other, "deck-9"]
    const generation = fc.oneof(fc.integer({ min: -1, max: 8 }), fc.constant(1.5), fc.constant(Number.NaN))
    const step: fc.Arbitrary<Command> = fc.oneof(
      fc.record({ command: fc.constant("exchange" as const), deck: fc.constantFrom(...decks) }),
      fc.record({
        command: fc.constant("call" as const),
        deck: fc.constantFrom(...decks),
        generation,
      }),
      fc.record({ command: fc.constant("rotate" as const), generation }),
      fc.constant({ command: "revoke" as const }),
    )
    fc.assert(
      fc.property(
        fc.constantFrom(principal, "agent@studio"),
        fc.constantFrom(...decks),
        fc.array(step, { maxLength: 12 }),
        (who, home, steps) => {
          let grant = openGrant(who, home)
          for (const command of steps) {
            const before = grant
            const result = oauth(grant, command)
            if (before.revoked) {
              expect(result.accepted).toBe(false)
              expect(result.grant).toBe(before)
            }
            if (!result.accepted && result.grant !== before) {
              expect(before.revoked).toBe(false)
              expect(result.grant.revoked).toBe(true)
              expect(command.command).toBe("rotate")
              if (command.command === "rotate") {
                expect(Number.isInteger(command.generation)).toBe(true)
                expect(command.generation).toBeGreaterThanOrEqual(1)
                expect(command.generation).toBeLessThan(before.generation)
              }
            }
            grant = result.grant
            let accepted = 0
            for (let age = 0; age <= grant.generation + 1; age += 1) {
              if (oauth(grant, { command: "call", deck: grant.deck, generation: age }).accepted) accepted += 1
            }
            expect(accepted).toBeLessThanOrEqual(1)
            if (grant.revoked) {
              expect(oauth(grant, { command: "exchange", deck: grant.deck }).accepted).toBe(false)
              expect(oauth(grant, { command: "call", deck: grant.deck, generation: grant.generation }).accepted).toBe(
                false,
              )
              expect(oauth(grant, { command: "rotate", generation: grant.generation }).accepted).toBe(false)
              expect(oauth(grant, { command: "revoke" }).accepted).toBe(false)
            }
          }
          expect(grant.principal).toBe(who)
        },
      ),
    )
  })
})
