import { readSetChange } from "@airdesign/catalog"
import {
  decide,
  formatOne,
  openRegister,
  planChange,
  registerScope,
  themeNode,
  type AlphaField,
  type Command,
  type FieldName,
  type FieldValue,
  type IndexElement,
  type InheritableField,
  type Kind,
  type Register,
  type TraitName,
  type Value,
  valueHolder,
} from "@airdesign/document"
import { indexPackage, paintReader, readPackage, readSlides } from "@airdesign/pptx"
import { panelOf } from "./design/panel"

export type Parts = ReadonlyMap<string, Uint8Array>

export type At = {
  readonly node: IndexElement["node"]
  readonly slide: string
  readonly part: string
  readonly shape: string
}

export const judgedCases: readonly { readonly covers?: readonly string[] }[] = Object.values(
  import.meta.glob<{ readonly covers?: readonly string[] }>("../../../scripts/pptx-cases/*.mjs", {
    import: "default",
    eager: true,
  }),
)

const indexes = new WeakMap<Parts, ReturnType<typeof indexPackage>>()

function packageIndex(parts: Parts): ReturnType<typeof indexPackage> {
  const known = indexes.get(parts)
  if (known !== undefined) return known
  const index = indexPackage(parts)
  indexes.set(parts, index)
  return index
}

export function element(parts: Parts, at: At): IndexElement | undefined {
  return packageIndex(parts).elements.find((each) => each.node === at.node)
}

async function readDeck(name: string): Promise<Parts> {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  const read = await readPackage(await fs.readFile(new URL(`../../../scripts/pptx-fixtures/${name}`, import.meta.url)))
  if (!read.ok) throw new Error(read.reason)
  return read.parts
}

const decks = new Map<string, Promise<Parts>>()

export function deckParts(name: string): Promise<Parts> {
  const known = decks.get(name)
  if (known !== undefined) return known
  const read = readDeck(name)
  decks.set(name, read)
  return read
}

export function indexed(parts: Parts): Register {
  const index = packageIndex(parts)
  return { ...openRegister("", "clean"), index: { ...index, total: index.elements.length, pages: [] } }
}

export function landed(register: Register, commands: readonly Command[]): Register | null {
  let current = register
  for (const command of commands) {
    const decision = decide(current, command)
    if (decision.decision === "refuse") return null
    current = decision.register
  }
  return current
}

export function placed(parts: Parts, kind: Kind, node?: string): At {
  const deck = kind === "deck"
  const found = packageIndex(parts).elements.find(
    (each) =>
      each.kind === (deck ? "shape" : kind) && !each.grouped && (deck || node === undefined || each.node === node),
  )
  if (found === undefined) throw new Error(kind)
  const [slide = "", shape = ""] = found.node.split(".")
  const part = readSlides(parts).find((each) => each.slide === slide)?.part ?? ""
  return { node: deck ? themeNode : found.node, slide, part, shape }
}

export function agentRegister(register: Register, at: At, example: object): Register | null {
  const read = readSetChange({ op: "set", target: at.node, ...example })
  if (!read.ok) return null
  const opened = landed(register, [
    { command: "add", node: at.node, floor: "", route: "clean" },
    { command: "start", runId: "parity", node: at.node },
  ])
  const planned = opened === null ? null : planChange(read.change, registerScope(opened))
  if (opened === null || planned === null || !planned.ok) return null
  return landed(
    opened,
    planned.rows.map(({ node, row }) => ({ command: "agent", runId: "parity", readAt: 0, node, ...row })),
  )
}

export function painted(parts: Parts, at: At): string {
  const drawn = paintReader(parts).slide(at.part).elements
  return JSON.stringify(drawn.filter((each) => each.from === "slide" && each.shape === at.shape))
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left === right) return true
  if (left.length !== right.length) return false
  for (let at = 0; at < left.length; at += 1) if (left[at] !== right[at]) return false
  return true
}

export function sameParts(left: Parts, right: Parts): boolean {
  if (left.size !== right.size) return false
  return [...left].every(([name, bytes]) => {
    const other = right.get(name)
    return other !== undefined && sameBytes(other, bytes)
  })
}

export type FieldProbe<T extends TraitName, F extends FieldName<T>> = {
  readonly file: (parts: Parts, at: At) => unknown
  readonly shows: (value: FieldValue<T, F>) => unknown
} & (F extends InheritableField<T> ? { readonly inherited: (parts: Parts, at: At) => boolean } : unknown)

export type Shown<T extends TraitName> = Exclude<FieldName<T>, AlphaField<T>>

export type Probe<T extends TraitName> = [FieldName<T>] extends [never]
  ? { readonly fields: Readonly<Record<never, never>> }
  : {
      readonly deck: string
      readonly kind: Kind
      readonly node?: string
      readonly opening: (parts: Parts, at: At) => Value
      readonly edit: (opening: Value, field: Shown<T>, value: FieldValue<T, Shown<T>>) => Value
      readonly fields: { readonly [F in Shown<T>]-?: FieldProbe<T, F> }
      readonly painted?: (parts: Parts, at: At, field: string) => string
    }

function panelControl(register: Register, at: At, trait: TraitName, field: string) {
  const view = registerScope(register).view(at.node)
  const sections = view === undefined ? undefined : panelOf(view, { reads: {}, moves: true }).sections
  return sections
    ?.flatMap((section) => section.strips.flat())
    .find((each) => each.trait === trait && each.field === field)
}

export function panelRegister(
  register: Register,
  at: At,
  trait: TraitName,
  field: string,
  value: unknown,
): Register | null {
  const scope = registerScope(register)
  const control = panelControl(register, at, trait, field)
  const planned = control === undefined ? null : planChange(control.change(value), scope)
  if (planned === null || !planned.ok) return null
  const holder = valueHolder(register, at.node, "person")
  const commands = planned.rows.flatMap(({ node, row: planned }): Command[] =>
    (formatOne(planned.patch, holder) ?? [planned]).map((each) => ({ command: "person", node, ...each })),
  )
  const opened = landed(register, [{ command: "add", node: at.node, floor: "", route: "clean" }])
  return commands.length === 0 || opened === null ? null : landed(opened, commands)
}
