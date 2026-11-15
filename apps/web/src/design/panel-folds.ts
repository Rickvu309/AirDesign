import { useSyncExternalStore } from "react"
import type { SectionName } from "./panel"
import type { PanelKind } from "./panel-order"

export type Folds = ReadonlyMap<string, boolean>

const stored = "airdesign.panel-folds"

function kept(): Folds {
  try {
    const read: unknown = JSON.parse(sessionStorage.getItem(stored) ?? "{}")
    if (typeof read !== "object" || read === null) return new Map()
    return new Map(Object.entries(read).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean"))
  } catch {
    return new Map()
  }
}

function keep(folds: Folds): void {
  try {
    sessionStorage.setItem(stored, JSON.stringify(Object.fromEntries(folds)))
  } catch {
    return
  }
}

let held: Folds = kept()
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function folds(): Folds {
  return held
}

export function setFold(kind: PanelKind, section: SectionName, open: boolean): void {
  held = new Map(held).set(`${kind}.${section}`, open)
  keep(held)
  for (const listener of listeners) listener()
}

export function foldOpen(shown: Folds, kind: PanelKind, section: SectionName, fallback: boolean): boolean {
  return shown.get(`${kind}.${section}`) ?? fallback
}

export function useFolds(): Folds {
  return useSyncExternalStore(subscribe, folds, folds)
}
