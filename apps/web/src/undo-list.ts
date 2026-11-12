import {
  redoOf,
  undoOf,
  type Box,
  type ElementId,
  type Register,
  type SlideCommand,
  type SlideId,
  type Undoable,
} from "@airdesign/document"
import { undoCopy, type UndoName } from "@/copy/undo-copy"

export type UndoEntry = { readonly name: UndoName; readonly undoable: Undoable; readonly session?: number }

export type UndoList = { readonly undo: readonly UndoEntry[]; readonly redo: readonly UndoEntry[] }

export type UndoDirection = "undo" | "redo"

type Kept = Promise<{ readonly ok: boolean }>

export type UndoLink = {
  openDeck(deck: string): Promise<{ readonly ok: true; readonly register: Register } | { readonly ok: false }>
  enqueue(deck: string, value: string, node: ElementId, floor: string): Kept
  enqueueBox(deck: string, box: Box, node: ElementId, floor: string): Kept
  enqueueSlide(deck: string, file: readonly SlideId[], edit: SlideCommand): Kept
}

export type TurnedBack =
  | { readonly outcome: "turned" | "changed"; readonly list: UndoList; readonly entry: UndoEntry }
  | { readonly outcome: "empty"; readonly list: UndoList }

export const emptyUndo: UndoList = { undo: [], redo: [] }

const kept = 100

function joined(top: UndoEntry | undefined, entry: UndoEntry): UndoEntry | null {
  if (top === undefined || entry.session === undefined || top.session !== entry.session) return null
  if (!("node" in top.undoable) || !("node" in entry.undoable) || top.undoable.node !== entry.undoable.node) return null
  return { ...top, undoable: { ...top.undoable, after: entry.undoable.after } }
}

function unchanged(entry: UndoEntry): boolean {
  return "node" in entry.undoable && JSON.stringify(entry.undoable.before) === JSON.stringify(entry.undoable.after)
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

async function sent(link: UndoLink, deck: string, register: Register, entry: UndoEntry, direction: UndoDirection) {
  const turn = direction === "undo" ? undoOf(register, entry.undoable) : redoOf(register, entry.undoable)
  if (!turn.ok) return false
  const { command } = turn
  if (command.command === "slide") return (await link.enqueueSlide(deck, command.file, command.edit)).ok
  if (command.command !== "person" || command.node === undefined || !("floor" in entry.undoable)) return false
  const { floor } = entry.undoable
  if (command.property === "box") return (await link.enqueueBox(deck, command.value, command.node, floor)).ok
  return (await link.enqueue(deck, command.value, command.node, floor)).ok
}

export async function turnBack(
  link: UndoLink,
  deck: string,
  list: UndoList,
  direction: UndoDirection,
): Promise<TurnedBack> {
  const entry = list[direction].at(-1)
  if (entry === undefined) return { outcome: "empty", list }
  const opened = await link.openDeck(deck)
  const rest = list[direction].slice(0, -1)
  const left: UndoList = direction === "undo" ? { undo: rest, redo: list.redo } : { undo: list.undo, redo: rest }
  if (!opened.ok || !(await sent(link, deck, opened.register, entry, direction))) {
    return { outcome: "changed", list: left, entry }
  }
  const other = direction === "undo" ? "redo" : "undo"
  return { outcome: "turned", list: { ...left, [other]: [...left[other], entry] }, entry }
}
