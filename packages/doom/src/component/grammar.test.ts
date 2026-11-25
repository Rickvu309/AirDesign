import { expect, it } from "vitest"
import { defaultTheme, doomFromTree, isRefusal } from "../index.js"
import progress from "./testing/progress-bars.json" with { type: "json" }
import { measure, mint } from "./testing/linked-instance-fixtures.js"
import { fieldTypeNames } from "./collections.js"
import { prepareComponentWrite } from "./component-write.js"
import { expressionForms } from "./expression.js"
import { operatorNames } from "./operators.js"
import { readComponentSpec } from "./spec.js"

declare const process: {
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string, encoding: "utf8"): string }
}

const grammar = process.getBuiltinModule("node:fs").readFileSync("packages/doom/src/component/grammar/1.md", "utf8")
const example = JSON.parse(/```json\n([\s\S]*?)```/.exec(grammar)?.[1] ?? "null") as unknown

it("expands the doc's example with no findings", () => {
  const { doom } = doomFromTree({ theme: defaultTheme, slides: [{ children: [] }] })
  const made = prepareComponentWrite(doom, { spec: example }, measure, mint)
  if (isRefusal(made)) throw new Error(JSON.stringify(made))
  expect(made.findings).toEqual([])
  expect(example).toEqual(progress)
})

function emitKinds(): readonly string[] {
  const spec = JSON.parse(JSON.stringify(progress)) as { parts: { emit: { kind: string } }[] }
  spec.parts[0]!.emit.kind = "unknown"
  const refused = readComponentSpec(spec)
  const listed = isRefusal(refused) ? /^One of (.*)\.$/.exec(refused.form ?? "")?.[1] : undefined
  if (listed === undefined) throw new Error(JSON.stringify(refused))
  return listed.split(", ")
}

it("names every operator, emit kind and field type the reader accepts", () => {
  const named = (word: string) => grammar.includes(`\`${word}\``) || grammar.includes(`"${word}`)
  const words = [...operatorNames, ...expressionForms, ...emitKinds(), ...fieldTypeNames]
  expect(emitKinds()).toContain("rect")
  expect(words.filter((word) => !named(word))).toEqual([])
})
