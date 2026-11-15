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

type Kept = Promise<{ readonly ok: boolean }>

export type UndoLink = {
  openDeck(deck: string): Promise<{ readonly ok: true; readonly register: Register } | { readonly ok: false }>
  enqueue(deck: string, value: string, node: ElementId, floor: string): Kept
  enqueueBox(deck: string, box: Box, node: ElementId, floor: string): Kept
  enqueueRow(deck: string, row: Row, node: ElementId, floor: string): Kept
  enqueueSlide(deck: string, file: readonly SlideId[], edit: SlideCommand): Kept
}

export type TurnedBack =
  | { readonly outcome: "turned" | "changed"; readonly list: UndoList; readonly entry: UndoEntry }
  | { readonly outcome: "empty"; readonly list: UndoList }

export const emptyUndo: UndoList = { undo: [], redo: [] }

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

function onlyStep(undoable: Undoable): NodeStep | undefined {
  return "steps" in undoable && undoable.steps.length === 1 ? undoable.steps[0] : undefined
}

function joined(top: UndoEntry | undefined, entry: UndoEntry): UndoEntry | null {
  if (top === undefined || entry.session === undefined || top.session !== entry.session) return null
  const below = onlyStep(top.undoable)
  const above = onlyStep(entry.undoable)
  if (below === undefined || above === undefined || below.node !== above.node) return null
  return { ...top, undoable: { steps: [{ ...below, after: above.after }] } }
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

export function undoLabel(direction: UndoDirection, list: UndoList): string {
  const entry = list[direction].at(-1)
  if (entry === undefined) return direction === "undo" ? undoCopy.undo : undoCopy.redo
  return direction === "undo" ? undoCopy.undoNamed[entry.name] : undoCopy.redoNamed[entry.name]
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
  for (const command of turn.commands) if (!(await sentCommand(link, deck, command))) return null
  return { ...entry, undoable: turn.undoable }
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
  const register = !opened.ok ? null : "group" in entry.undoable ? grouped(opened.register) : opened.register
  const turned = register === null ? null : await sent(link, deck, register, entry, direction)
  if (turned === null) return { outcome: "changed", list: left, entry }
  const other = direction === "undo" ? "redo" : "undo"
  return { outcome: "turned", list: { ...left, [other]: [...left[other], turned] }, entry: turned }
}
