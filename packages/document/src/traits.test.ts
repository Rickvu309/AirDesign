import { describe, expect, it } from "vitest"
import { kinds, kindTraits, type FieldKey } from "./index.js"
import {
  fieldKeys,
  traitNames,
  traits,
  type FieldName,
  type FieldValue,
  type HasAlpha,
  type TraitValue,
  type WireAgent,
  type WireField,
} from "./traits.js"

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
type Expect<T extends true> = T

export type Derived = [
  Expect<Same<FieldName<"box">, "x" | "y" | "w" | "h">>,
  Expect<Same<FieldValue<"box", "w">, number>>,
  Expect<Same<TraitValue<"notes">, { readonly value: string }>>,
  Expect<Same<FieldName<"fill">, never>>,
  Expect<Same<WireField<"box">, "x" | "y" | "w" | "h">>,
  Expect<Same<WireAgent<"box", "x">, number>>,
  Expect<Same<WireAgent<"text", "value">, string>>,
  Expect<Same<HasAlpha, false>>,
  Expect<"table.value" extends FieldKey ? true : false>,
  Expect<"fill.value" extends FieldKey ? false : true>,
]

describe("the one table of traits", () => {
  it("declares the thirteen slots with the rule PowerPoint inherits each by", () => {
    expect(Object.fromEntries(traitNames.map((name) => [name, traits[name].inherits]))).toEqual({
      identity: "own",
      box: "whole",
      geometry: "whole",
      fill: "whole",
      line: "field",
      effects: "whole",
      body: "field",
      text: "run",
      image: "own",
      crop: "own",
      connection: "own",
      table: "own",
      notes: "own",
    })
  })

  it("holds only the fields that are live: the box, text, notes and table values", () => {
    expect(traitNames.flatMap(fieldKeys)).toEqual([
      "box.x",
      "box.y",
      "box.w",
      "box.h",
      "text.value",
      "table.value",
      "notes.value",
    ])
  })

  it("gives every kind a closed list of declared traits", () => {
    for (const kind of kinds) for (const trait of kindTraits[kind]) expect(traitNames).toContain(trait)
    expect(kindTraits.group).toEqual(["identity", "box", "effects"])
    expect(kindTraits.slide).toEqual(["notes"])
  })
})
