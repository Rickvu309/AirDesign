import {
  redoOf,
  undoOf,
  type Box,
  type Command,
  type ElementId,
  type NodeStep,
  type Register,
  type Row,
  type SlideCommand,
  type SlideId,
  type Undoable,
} from "@airdesign/document"
import { undoCopy, type UndoName } from "@/copy/undo-copy"

export type Typing = { readonly node: ElementId; readonly session: number; readonly before: Promise<string> }

export type UndoEntry = { readonly name: UndoName; readonly undoable: Undoable; readonly session?: number }

export type UndoList = { readonly undo: readonly UndoEntry[]; readonly redo: readonly UndoEntry[] }

export type UndoDirection = "undo" | "redo"

export type UndoShown = {
  readonly undo: UndoName | null
  readonly redo: UndoName | null
  readonly told: UndoDirection | null
}

type Kept = Promise<{ readonly ok: boolean }>

export type UndoLink = {
  openDeck(deck: string): Promise<{ readonly ok: true; readonly register: Register } | { readonly ok: false }>
  enqueue(deck: string, value: string, node: ElementId, floor: string): Kept
  enqueueBox(deck: string, box: Box, node: ElementId, floor: string): Kept
  enqueueRow(deck: string, row: Row, node: ElementId, floor: string): Kept
  enqueueSlides?(deck: string, file: readonly SlideId[], edits: readonly SlideCommand[]): Kept
  enqueueSlide(deck: string, file: readonly SlideId[], edit: SlideCommand): Kept
}

export type TurnedBack =
  | { readonly outcome: "turned" | "changed"; readonly list: UndoList; readonly entry: UndoEntry }
  | { readonly outcome: "empty"; readonly list: UndoList }

export const emptyUndo: UndoList = { undo: [], redo: [] }

export const emptyShown: UndoShown = { undo: null, redo: null, told: null }

export type RecordsInFlight = { readonly hold: () => () => void; readonly landed: () => Promise<void> }

export function recordsInFlight(): RecordsInFlight {
  let all = Promise.resolve()
  return {
    hold() {
      let release: () => void = () => undefined
      const held = new Promise<undefined>((resolve) => {
        release = () => resolve(undefined)
      })
      all = Promise.all([all, held]).then(() => undefined)
      return release
    },
    landed: () => all,
  }
}

const kept = 100

function stepsOf(undoable: Undoable): readonly NodeStep[] {
  return "steps" in undoable ? undoable.steps : []
}

function joined(top: UndoEntry | undefined, entry: UndoEntry): UndoEntry | null {
  if (top === undefined || entry.session === undefined || top.session !== entry.session) return null
  const below = stepsOf(top.undoable)
  const above = stepsOf(entry.undoable)
  if (below.length === 0 || below.length !== above.length) return null
  if (below.some((step, index) => step.node !== above[index]?.node)) return null
  return {
    ...top,
    undoable: { steps: below.map((step, index) => ({ ...step, after: above[index]?.after ?? step.after })) },
  }
}

function unchanged(entry: UndoEntry): boolean {
  return (
    "steps" in entry.undoable &&
    entry.undoable.steps.every((step) => JSON.stringify(step.before) === JSON.stringify(step.after))
  )
}

export function recorded(list: UndoList, entry: UndoEntry): UndoList {
  const top = list.undo.at(-1)
  const merged = joined(top, entry)
  const below = merged === null ? list.undo : list.undo.slice(0, -1)
  const next = merged ?? entry
  return { undo: unchanged(next) ? below : [...below, next].slice(-kept), redo: [] }
}

export function shownOf(list: UndoList, told: UndoDirection | null): UndoShown {
  return { undo: list.undo.at(-1)?.name ?? null, redo: list.redo.at(-1)?.name ?? null, told }
}

export function sameShown(left: UndoShown, right: UndoShown): boolean {
  return left.undo === right.undo && left.redo === right.redo && left.told === right.told
}

export function undoLabel(direction: UndoDirection, shown: UndoShown): string {
  const name = shown[direction]
  if (name === null) return direction === "undo" ? undoCopy.undo : undoCopy.redo
  return direction === "undo" ? undoCopy.undoNamed[name] : undoCopy.redoNamed[name]
}

async function sentCommand(link: UndoLink, deck: string, command: Command): Promise<boolean> {
  if (command.command === "slide") return (await link.enqueueSlide(deck, command.file, command.edit)).ok
  if (command.command !== "person" || command.node === undefined) return false
  if (command.v !== undefined)
    return (await link.enqueueRow(deck, { v: command.v, patch: command.patch }, command.node, "")).ok
  if (command.property === "box") return (await link.enqueueBox(deck, command.value, command.node, "")).ok
  return (await link.enqueue(deck, command.value, command.node, "")).ok
}

async function sent(
  link: UndoLink,
  deck: string,
  register: Register,
  entry: UndoEntry,
  direction: UndoDirection,
): Promise<UndoEntry | null> {
  const turn = direction === "undo" ? undoOf(register, entry.undoable) : redoOf(register, entry.undoable)
  if (!turn.ok) return null
  const [first] = turn.commands
  if (
    first?.command === "slide" &&
    turn.commands.length > 1 &&
    link.enqueueSlides !== undefined &&
    turn.commands.every((command) => command.command === "slide")
  ) {
    if (
      !(
        await link.enqueueSlides(
          deck,
          first.file,
          turn.commands.map(({ edit }) => edit),
        )
      ).ok
    )
      return null
  } else {
    for (const command of turn.commands) if (!(await sentCommand(link, deck, command))) return null
  }
  return { ...entry, undoable: turn.undoable }
}

function structural(undoable: Undoable): boolean {
  return "group" in undoable || "joined" in undoable
}

export async function turnBack(
  link: UndoLink,
  deck: string,
  list: UndoList,
  direction: UndoDirection,
  grouped: (register: Register) => Register = (register) => register,
): Promise<TurnedBack> {
  const entry = list[direction].at(-1)
  if (entry === undefined) return { outcome: "empty", list }
  const opened = await link.openDeck(deck)
  const rest = list[direction].slice(0, -1)
  const left: UndoList = direction === "undo" ? { undo: rest, redo: list.redo } : { undo: list.undo, redo: rest }
  const register = !opened.ok ? null : structural(entry.undoable) ? grouped(opened.register) : opened.register
  const turned = register === null ? null : await sent(link, deck, register, entry, direction)
  if (turned === null) return { outcome: "changed", list: left, entry }
  const other = direction === "undo" ? "redo" : "undo"
  return { outcome: "turned", list: { ...left, [other]: [...left[other], turned] }, entry: turned }
}
