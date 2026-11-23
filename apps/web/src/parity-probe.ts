import { readSetChange } from "@airdesign/catalog"
import {
  decide,
  formatOne,
  openRegister,
  planChange,
  registerScope,
  templateStylesNode,
  readElementId,
  type AlphaField,
  type Command,
  type FieldName,
  type IndexElement,
  type InheritableField,
  type InputName,
  type Kind,
  type Register,
  type SetChange,
  type SlotField,
  type TraitName,
  type Value,
  valueHolder,
} from "@airdesign/document"
import {
  indexPackage,
  paintReader,
  readPackage,
  readSlides,
  shownImage,
  shownPictureMode,
  shownTileScale,
} from "@airdesign/pptx"
import { fillSlotFields } from "./design/fill-slots"
import { panelOf, shownPlace } from "./design/panel"
import { sectionInMode } from "./design/panel-order"

export type Parts = ReadonlyMap<string, Uint8Array>

export type At = {
  readonly node: IndexElement["node"]
  readonly slide: string
  readonly part: string
  readonly shape: string
}

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
  const own = node?.endsWith(".slide") === true
  const found = packageIndex(parts).elements.find(
    (each) =>
      each.kind === (deck || own ? "shape" : kind) &&
      !each.grouped &&
      (deck || own || node === undefined || each.node === node),
  )
  if (found === undefined) throw new Error(kind)
  const [slide = "", shape = ""] = found.node.split(".")
  const part = readSlides(parts).find((each) => each.slide === slide)?.part ?? ""
  return {
    node: own ? (readElementId(node) ?? found.node) : deck ? templateStylesNode : found.node,
    slide,
    part,
    shape,
  }
}

export function agentRegister(register: Register, at: At, example: object): Register | null {
  const read = readSetChange({ op: "set", target: at.node, ...example })
  if (!read.ok) return null
  const planned = planChange(read.change, registerScope(register))
  if (!planned.ok) return null
  const opened = landed(
    register,
    planned.rows.flatMap(({ node }): Command[] => [
      { command: "add", node, floor: "", route: "clean" },
      { command: "start", runId: "parity", node },
    ]),
  )
  if (opened === null) return null
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

type SlotInput<T extends TraitName> = [SlotField<T>] extends [never] ? never : InputName<T>

export type Shown<T extends TraitName> = Exclude<FieldName<T>, AlphaField<T> | SlotField<T>> | SlotInput<T>

type Inputs<T extends TraitName> = NonNullable<SetChange[T]>

type ShownValue<T extends TraitName, F> = F extends keyof Inputs<T> ? NonNullable<Inputs<T>[F]> : never

export type FieldProbe<T extends TraitName, F extends Shown<T>> = {
  readonly file: (parts: Parts, at: At) => unknown
  readonly shows: (value: ShownValue<T, F>) => unknown
  readonly on?: { readonly deck: string; readonly kind: Kind; readonly node: string }
} & (F extends InheritableField<T> ? { readonly inherited: (parts: Parts, at: At) => boolean } : unknown)

export type Probe<T extends TraitName> = [FieldName<T>] extends [never]
  ? { readonly fields: Readonly<Record<never, never>> }
  : {
      readonly deck: string
      readonly kind: Kind
      readonly node?: string
      readonly opening: (parts: Parts, at: At) => Value
      readonly edit: (opening: Value, field: Shown<T>, value: ShownValue<T, Shown<T>>) => Value
      readonly fields: { readonly [F in Shown<T>]-?: FieldProbe<T, F> }
      readonly painted?: (parts: Parts, at: At, field: string) => string
    }

function panelControl(register: Register, at: At, trait: TraitName, field: string, parts?: Parts) {
  const view = registerScope(register).view(at.node)
  const fields =
    parts === undefined
      ? undefined
      : {
          ...fillSlotFields(parts, at),
          "fills.mode": { value: shownPictureMode(parts, at), own: true },
          "fills.tileScale": { value: shownTileScale(parts, at), own: true },
          "fills.weight": { value: shownImage(parts, at)?.weight ?? null, own: true },
          "fills.color": { value: shownImage(parts, at)?.color ?? null, own: true },
        }
  const sections =
    view === undefined
      ? undefined
      : panelOf(view, { reads: {}, moves: true, ...(fields === undefined ? {} : { fields }) }).sections
  const controls = sections?.flatMap((section) => sectionInMode(section, "design").strips.flat())
  if (trait === "text" && (field === "fill" || field === "color"))
    return controls?.find(
      (each) =>
        (each.trait === "textFill" && each.field === "value") || (each.trait === "text" && each.field === "fill"),
    )
  const place = shownPlace(trait, field)
  return controls?.find((each) => each.trait === place.trait && each.field === place.field)
}

export function panelRegister(
  register: Register,
  at: At,
  trait: TraitName,
  field: string,
  value: unknown,
  parts?: Parts,
): Register | null {
  const scope = registerScope(register)
  const control = panelControl(register, at, trait, field, parts)
  const input = trait === "text" && field === "color" ? { solid: value } : value
  const planned = control === undefined ? null : planChange(control.change(input), scope)
  if (planned === null || !planned.ok) return null
  const holder = valueHolder(at.node)
  const commands = planned.rows.flatMap(({ node, row: planned }): Command[] =>
    (formatOne(planned.patch, holder) ?? [planned]).map((each) => ({ command: "person", node, ...each })),
  )
  const opened = landed(
    register,
    planned.rows.map(({ node }) => ({ command: "add", node, floor: "", route: "clean" })),
  )
  return commands.length === 0 || opened === null ? null : landed(opened, commands)
}
