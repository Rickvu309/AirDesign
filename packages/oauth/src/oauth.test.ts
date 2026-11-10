import fc from "fast-check"
import { describe, expect, it } from "vitest"
import { oauth, openGrant, type Command, type Grant } from "./index.js"

const principal = "ada@studio"

function exchanged(who = principal): Grant {
  const open = openGrant(who)
  const result = oauth(open, { command: "exchange" })
  expect(result.accepted).toBe(true)
  expect(result.grant.code).toBe("used")
  expect(result.grant.generation).toBe(1)
  expect(result.grant.principal).toBe(who)
  return result.grant
}

describe("oauth", () => {
  it("a code works once", () => {
    const open = openGrant(principal)
    const first = oauth(open, { command: "exchange" })
    expect(first.accepted).toBe(true)
    expect(first.grant.code).toBe("used")
    expect(first.grant.generation).toBe(1)
    const second = oauth(first.grant, { command: "exchange" })
    expect(second.accepted).toBe(false)
    expect(second.grant).toBe(first.grant)
  })

  it("a rotated refresh token never works again", () => {
    const current = oauth(exchanged(), { command: "rotate", generation: 1 })
    expect(current.accepted).toBe(true)
    expect(current.grant.generation).toBe(2)
    const call = oauth(current.grant, { command: "call", generation: 1 })
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
    const later = oauth(reused.grant, { command: "call", generation: 2 })
    expect(later.accepted).toBe(false)
    expect(later.grant).toBe(reused.grant)
  })

  it("after revocation no call and no rotation is accepted", () => {
    const live = exchanged()
    const revoked = oauth(live, { command: "revoke" })
    expect(revoked.accepted).toBe(true)
    expect(revoked.grant.revoked).toBe(true)
    const call = oauth(revoked.grant, { command: "call", generation: 1 })
    expect(call.accepted).toBe(false)
    expect(call.grant).toBe(revoked.grant)
    const rotate = oauth(revoked.grant, { command: "rotate", generation: 1 })
    expect(rotate.accepted).toBe(false)
    expect(rotate.grant).toBe(revoked.grant)
    const again = oauth(revoked.grant, { command: "revoke" })
    expect(again.accepted).toBe(false)
    expect(again.grant).toBe(revoked.grant)
  })

  it("the identity is the stored one", () => {
    const grant = exchanged("agent@studio")
    const call = oauth(grant, { command: "call", generation: 1 })
    expect(call.accepted).toBe(true)
    expect(call.grant).toBe(grant)
    expect(call.grant.principal).toBe("agent@studio")
    const person = exchanged(principal)
    expect(person.principal).toBe(principal)
    expect(person.principal).not.toBe(grant.principal)
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
      const call = oauth(grant, { command: "call", generation })
      expect(call.accepted).toBe(false)
      expect(call.grant).toBe(grant)
    }
    const newest = oauth(grant, { command: "call", generation: 6 })
    expect(newest.accepted).toBe(true)
    expect(newest.grant).toBe(grant)
    expect(newest.grant.principal).toBe(principal)
  })

  it("a call with the previous generation fails after a rotation", () => {
    const rotated = oauth(exchanged(), { command: "rotate", generation: 1 })
    expect(rotated.accepted).toBe(true)
    const previous = oauth(rotated.grant, { command: "call", generation: 1 })
    expect(previous.accepted).toBe(false)
    expect(previous.grant).toBe(rotated.grant)
    const current = oauth(rotated.grant, { command: "call", generation: 2 })
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
    }
  })

  it("a fresh grant accepts no call and no rotation", () => {
    const grant = openGrant(principal)
    expect(grant.principal).toBe(principal)
    expect(grant.code).toBe("open")
    expect(grant.generation).toBe(0)
    expect(grant.revoked).toBe(false)
    for (const generation of [0, 1]) {
      const call = oauth(grant, { command: "call", generation })
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
      const call = oauth(rotated.grant, { command: "call", generation })
      expect(call.accepted).toBe(false)
      expect(call.grant).toBe(rotated.grant)
      expect(call.grant.revoked).toBe(false)
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
    const result = oauth(grant, null as unknown as Command)
    expect(result.accepted).toBe(false)
    expect(result.grant).toBe(grant)
    expect(result.grant.revoked).toBe(false)
  })

  it("a command that is not an object is refused and does not throw", () => {
    const grant = exchanged()
    for (const word of [undefined, "revoke", 7, true]) {
      const result = oauth(grant, word as unknown as Command)
      expect(result.accepted).toBe(false)
      expect(result.grant).toBe(grant)
    }
  })

  it("an extra principal key is ignored", () => {
    const grant = exchanged()
    const plain = { command: "call" as const, generation: 1 }
    const extra = { ...plain, principal: "intruder", actor: "intruder" }
    const clean = oauth(grant, plain)
    const dirty = oauth(grant, extra)
    expect(clean.accepted).toBe(true)
    expect(dirty.accepted).toBe(true)
    expect(dirty.grant).toBe(grant)
    expect(dirty.grant.principal).toBe(principal)
    expect(dirty.grant).toEqual(clean.grant)
  })

  it("no command can write an extra key into the grant", () => {
    const extras = { principal: "intruder", actor: "intruder", deck: "258.8", revoked: true, code: "open" }
    const cases: readonly (readonly [Grant, Command])[] = [
      [openGrant(principal), { command: "exchange" }],
      [exchanged(), { command: "call", generation: 1 }],
      [exchanged(), { command: "rotate", generation: 1 }],
      [exchanged(), { command: "revoke" }],
    ]
    for (const [grant, command] of cases) {
      const clean = oauth(grant, command)
      const dirty = oauth(grant, { ...command, ...extras } as Command)
      expect(clean.accepted).toBe(true)
      expect(dirty).toEqual(clean)
      expect(dirty.grant.principal).toBe(principal)
      expect(Object.keys(dirty.grant).sort()).toEqual(["code", "generation", "principal", "revoked"])
    }
  })

  it("a call with a generation that is not a number is refused", () => {
    const grant = exchanged()
    for (const generation of ["1", true, [1], null, undefined, { valueOf: () => 1 }]) {
      const result = oauth(grant, { command: "call", generation } as unknown as Command)
      expect(result.accepted).toBe(false)
      expect(result.grant).toBe(grant)
    }
  })

  it("an extra key never changes an answer", () => {
    const text = fc.oneof(fc.constant("intruder"), fc.string({ maxLength: 4 }))
    const extra = fc.record(
      {
        principal: text,
        actor: text,
        deck: text,
        owner: text,
        code: fc.constantFrom("open", "used"),
        generation: fc.integer({ min: 0, max: 9 }),
        revoked: fc.boolean(),
      },
      { requiredKeys: [] },
    )
    const unknown = fc.dictionary(fc.string({ minLength: 1, maxLength: 6 }), fc.jsonValue({ maxDepth: 1 }), {
      maxKeys: 3,
    })
    const generation = fc.integer({ min: 0, max: 3 })
    const command: fc.Arbitrary<Command> = fc.oneof(
      { weight: 1, arbitrary: fc.constant<Command>({ command: "exchange" }) },
      { weight: 2, arbitrary: generation.map<Command>((value) => ({ command: "call", generation: value })) },
      { weight: 5, arbitrary: generation.map<Command>((value) => ({ command: "rotate", generation: value })) },
      { weight: 1, arbitrary: fc.constant<Command>({ command: "revoke" }) },
    )
    fc.assert(
      fc.property(fc.boolean(), fc.array(fc.tuple(command, extra, unknown), { maxLength: 10 }), (fresh, steps) => {
        let grant = fresh ? openGrant(principal) : exchanged()
        for (const [plain, keys, words] of steps) {
          const clean = oauth(grant, plain)
          const dirty = oauth(grant, { ...words, ...keys, ...plain } as Command)
          expect(dirty).toEqual(clean)
          expect(dirty.grant.principal).toBe(principal)
          expect(Object.keys(dirty.grant).sort()).toEqual(["code", "generation", "principal", "revoked"])
          if (clean.grant === grant) {
            expect(dirty.grant).toBe(grant)
          }
          grant = clean.grant
        }
      }),
    )
  })

  it("a rotate with a generation that is not a number is refused and does not revoke", () => {
    const first = exchanged()
    const second = oauth(first, { command: "rotate", generation: 1 }).grant
    expect(second.generation).toBe(2)
    for (const grant of [first, second]) {
      for (const generation of ["1", true, [1], null, undefined, { valueOf: () => 1 }]) {
        const result = oauth(grant, { command: "rotate", generation } as unknown as Command)
        expect(result.accepted).toBe(false)
        expect(result.grant).toBe(grant)
        expect(result.grant.revoked).toBe(false)
      }
    }
  })

  it("the stored principal stays exact", () => {
    for (const who of ["Alice", " ALICE ", "Ada@Studio", "", "Ñandú 258.7"]) {
      const opened = openGrant(who)
      expect(opened.principal).toBe(who)
      const first = oauth(opened, { command: "exchange" })
      expect(first.grant.principal).toBe(who)
      const called = oauth(first.grant, { command: "call", generation: 1 })
      expect(called.accepted).toBe(true)
      expect(called.grant.principal).toBe(who)
      const second = oauth(first.grant, { command: "rotate", generation: 1 })
      expect(second.grant.principal).toBe(who)
      const reused = oauth(second.grant, { command: "rotate", generation: 1 })
      expect(reused.grant.revoked).toBe(true)
      expect(reused.grant.principal).toBe(who)
      const revoked = oauth(first.grant, { command: "revoke" })
      expect(revoked.grant.principal).toBe(who)
    }
  })

  it("a command name must match exactly", () => {
    const opened = openGrant(principal)
    const live = exchanged()
    const named: readonly (readonly [Grant, string, object])[] = [
      [opened, "exchange", {}],
      [live, "call", { generation: 1 }],
      [live, "rotate", { generation: 1 }],
      [live, "revoke", {}],
    ]
    for (const [grant, name, fields] of named) {
      const capital = `${name.charAt(0).toUpperCase()}${name.slice(1)}`
      for (const word of [[name], name.toUpperCase(), capital, ` ${name}`, `${name} `]) {
        const result = oauth(grant, { command: word, ...fields } as unknown as Command)
        expect(result.accepted).toBe(false)
        expect(result.grant).toBe(grant)
      }
    }
  })

  it("an extra deck key is ignored", () => {
    const grant = exchanged()
    const plain = { command: "call" as const, generation: 1 }
    const extra = { ...plain, deck: "258.8" }
    const clean = oauth(grant, plain)
    const dirty = oauth(grant, extra)
    expect(clean.accepted).toBe(true)
    expect(dirty.accepted).toBe(true)
    expect(dirty.grant).toBe(grant)
    expect(dirty.grant).toEqual(clean.grant)
    const named = { command: "exchange" as const, deck: "258.8" }
    const exchange = oauth(openGrant(principal), named)
    expect(exchange.accepted).toBe(true)
    expect(exchange.grant.generation).toBe(1)
  })

  it("accepts at most one generation and nothing after revocation", () => {
    const generation = fc.oneof(fc.integer({ min: -1, max: 8 }), fc.constant(1.5), fc.constant(Number.NaN))
    const step: fc.Arbitrary<Command> = fc.oneof(
      fc.constant({ command: "exchange" as const }),
      fc.record({ command: fc.constant("call" as const), generation }),
      fc.record({ command: fc.constant("rotate" as const), generation }),
      fc.constant({ command: "revoke" as const }),
    )
    fc.assert(
      fc.property(fc.constantFrom(principal, "agent@studio"), fc.array(step, { maxLength: 12 }), (who, steps) => {
        let grant = openGrant(who)
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
            if (oauth(grant, { command: "call", generation: age }).accepted) accepted += 1
          }
          expect(accepted).toBeLessThanOrEqual(1)
          if (grant.revoked) {
            expect(oauth(grant, { command: "exchange" }).accepted).toBe(false)
            expect(oauth(grant, { command: "call", generation: grant.generation }).accepted).toBe(false)
            expect(oauth(grant, { command: "rotate", generation: grant.generation }).accepted).toBe(false)
            expect(oauth(grant, { command: "revoke" }).accepted).toBe(false)
          }
        }
        expect(grant.principal).toBe(who)
      }),
    )
  })
})
