import * as doom from "@airdesign/doom"
import { guide, styles } from "@airdesign/taste"
import { describe, expect, it } from "vitest"

import { callTool, type DeckHost, type Session } from "../index.js"
import { memoryDecks } from "./memory-decks.js"
import { testTheme } from "@airdesign/doom/testing"

const start = () => doom.doomFromTree({ theme: testTheme, slides: [{ name: "Title", children: [] }] }).doom
const estimate = doom.measureWith({})

type Answer = Record<string, any>
export type Data = Readonly<Record<string, unknown>>
export type Box = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

function agent() {
  const decks = memoryDecks(start)
  const host: DeckHost = { ...decks, measure: async () => ({ measure: estimate, missing: new Map() }) }
  let minted = 0
  let calls = 0
  const session: Session = { agent: "aira", mint: () => `minted${String((minted += 1))}` }
  const call = async (name: string, args: unknown) => {
    session.once = `call${String((calls += 1))}`
    const result = await callTool(`airdesign_${name}`, args, session, host)
    return { ...result, fields: result.fields as Answer }
  }
  return { call, fold: (deck: string) => decks.decks.get(deck as never)! }
}

const recipe = (kind: string): string => {
  const block = /```js\n([\s\S]*?)```/.exec(guide(`charts/${kind}`)?.markdown ?? "")?.[1]
  expect(block, kind).toBeDefined()
  return block!
}

const given = (script: string, name: string, value: unknown) => {
  const lines = script.split("\n")
  const first = lines.findIndex((line) => line.startsWith(`const ${name} = `))
  expect(first, name).toBeGreaterThanOrEqual(0)
  const after = lines.findIndex((line, at) => at > first && /^\S/.test(line) && !/^[\])}]/.test(line))
  const code = typeof value === "function" ? String(value) : JSON.stringify(value)
  return [...lines.slice(0, first), `const ${name} = ${code}`, ...lines.slice(after)].join("\n")
}

export const sampleOf = (kind: string, name: string): unknown => {
  const lines = (/```js\n([\s\S]*?)```/.exec(guide(`charts/${kind}`)?.markdown ?? "")?.[1] ?? "").split("\n")
  const first = lines.findIndex((line) => line.startsWith(`const ${name} = `))
  if (first < 0) return undefined
  const after = lines.findIndex((line, at) => at > first && /^\S/.test(line) && !/^[\])}]/.test(line))
  return new Function(lines.slice(first, after).join("\n").replace(`const ${name} = `, "return "))()
}

export const withData = (kind: string, data: Data) =>
  Object.entries(data).reduce((script, [name, value]) => given(script, name, value), recipe(kind))

export async function drawn(style: string, script: string) {
  const by = agent()
  const created = await by.call("execute", { script: `createDeck({ style: "${style}" })` })
  expect(created.ok, JSON.stringify(created.fields)).toBe(true)
  const { deck, slides } = created.fields as { deck: string; slides: string[] }
  const answer = await by.call("execute", { deck, script: given(script, "slide", slides[0]) })
  expect(answer.ok, JSON.stringify(answer.fields)).toBe(true)
  const fold = by.fold(deck)
  const layers = doom.childrenOf(fold, slides[0] as doom.NodeId)
  return { answer: answer.fields, fold, layers, chart: layers.at(-1)! }
}

export const named = (fold: doom.Doom, chart: doom.Node, name: string) =>
  doom.childrenOf(fold, chart.id).filter((node) => doom.propOf(node, "name") === name)
export const boxOf = (node: doom.Node): Box => doom.propOf(node, "box")!
export const charsOf = (node: doom.Node) => doom.propOf(node, "text")?.chars ?? ""
export const fillOf = (node: doom.Node) => {
  const paint = doom.propOf(node, "fills")?.[0]
  return paint?.kind === "solid" && typeof paint.color !== "string" ? paint.color.var : undefined
}
export const strokeOf = (node: doom.Node) => {
  const paint = doom.propOf(node, "strokes")?.[0]
  return paint?.kind === "solid" && typeof paint.color !== "string" ? paint.color.var : undefined
}
export const bottom = (box: Box) => box.y + box.h
export const right = (box: Box) => box.x + box.w
export const near = (actual: number, wanted: number, label: string) =>
  expect(Math.abs(actual - wanted), `${label}: ${String(actual)} against ${String(wanted)}`).toBeLessThanOrEqual(1)

export const ranked = (rows: Rows) =>
  rows.toSorted((a, b) => Number(a[0] === "Other") - Number(b[0] === "Other") || b[1] - a[1])

export type Rows = readonly (readonly [string, number])[]

export function drawsInEveryStyle(
  kind: string,
  variants: Readonly<Record<string, Data>>,
  check: (fold: doom.Doom, chart: doom.Node, data: Data) => void,
) {
  describe(`charts/${kind}`, () => {
    it("leads its description with when to read it", () => {
      expect(guide(`charts/${kind}`)?.description.startsWith(`Before you draw a ${kind.replace("-", " ")}`)).toBe(true)
    })
    for (const [variant, data] of Object.entries(variants))
      for (const { id } of styles)
        it(`${variant}, ${id}: no problems and the geometry its rules claim`, async () => {
          const { answer, fold, chart } = await drawn(id, withData(kind, data))
          expect(answer.problems).toEqual([])
          check(fold, chart, data)
        })
  })
}
