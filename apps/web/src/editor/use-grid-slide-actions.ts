import { limits, type NodeId } from "@airdesign/doom"
import { useLayoutEffect, useRef, useState, type RefObject } from "react"
import { slideListCopy } from "@/copy/slide-list-copy"
import type { GridCommand } from "@/editor/editor-grid-keys"
import { gridDrop, moveBelowPlace, type GridRange } from "@/editor/grid-drop"
import type { GridStep } from "@/editor/grid-interaction"
import type { GridLayout } from "@/editor/grid-lines"
import type { GridMoveSide } from "@/editor/grid-move"
import { pickedSlides, type GridPick } from "@/editor/grid-selection"
import type { SlideMenuAnchor, SlideMenuSet } from "@/editor/slide-menu"
import { setMoveAt, slideSetAction } from "@/editor/slide-set-actions"
import type { SlideStrip } from "@/editor/slide-sidebar"

export type GridMenu = { readonly index: number; readonly anchor: SlideMenuAnchor; readonly pointer: boolean }

type Follow = { readonly grip: NodeId } | "current" | null

export function gridMoveMessage(
  groups: readonly GridRange[],
  held: readonly number[],
  at: number,
  group: boolean,
): string {
  const first = at - held.filter((index) => index < at).length
  if (!group)
    return held.length === 1
      ? slideListCopy.moved((held[0] ?? first) + 1, first + 1)
      : slideListCopy.movedSeveral(held.length, first + 1)
  const from = groups.findIndex((range) => range.start === held[0])
  const to = groups.filter((range) => range.start < at && range.start !== held[0]).length
  return slideListCopy.groupMoved(from + 1, to + 1)
}

export function pointAt(x: number, y: number): SlideMenuAnchor {
  return { getBoundingClientRect: () => new DOMRect(x, y, 0, 0) }
}

export function useGridSlideActions({
  strip,
  layout,
  groups,
  picked,
  root,
  announce,
  dispatch,
  choose,
  onOpen,
}: {
  readonly strip: SlideStrip
  readonly layout: GridLayout
  readonly groups: readonly GridRange[]
  readonly picked: GridPick
  readonly root: RefObject<HTMLElement | null>
  readonly announce: (text: string) => void
  readonly dispatch: (step: GridStep) => void
  readonly choose: (index: number) => void
  readonly onOpen: (index: number) => void
}) {
  const ids: readonly string[] = layout.cards.map((card) => card.id)
  const shape = layout.cards.map((card) => `${String(card.group)}:${card.id}`).join(",")
  const { current, count } = strip
  const held = pickedSlides(picked, ids, current)
  const follow = useRef<Follow>(null)
  const [menu, setMenu] = useState<GridMenu | null>(null)

  function pickIds(made: readonly string[]) {
    const [anchor] = made
    dispatch({ kind: "pick", pick: anchor === undefined || made.length < 2 ? null : { anchor, slides: new Set(made) } })
  }

  useLayoutEffect(() => {
    const wanted = follow.current
    if (wanted === null) return
    follow.current = null
    const focused = document.activeElement
    const ours =
      focused === null ||
      focused === document.body ||
      root.current?.contains(focused) === true ||
      focused.closest('[role="menu"]') !== null
    if (!ours) return
    if (wanted === "current") {
      root.current
        ?.querySelector<HTMLElement>(`[data-slide-entry="${String(current + 1)}"]`)
        ?.focus({ preventScroll: true })
      return
    }
    const number = layout.cards.find((card) => card.id === wanted.grip)?.group
    root.current
      ?.querySelector<HTMLElement>(`[data-grid-group="${String(number)}"] [data-group-handle]`)
      ?.focus({ preventScroll: true, focusVisible: true })
  }, [shape, current])

  function moveSlides(moved: readonly number[], at: number, side: GridMoveSide) {
    const first = gridDrop(groups, moved, at, side)
    if (first === null || strip.onMoveGroups === undefined) return
    const keep = side === "keep"
    const head = ids[moved[0] ?? -1]
    const movedIds = moved.flatMap((index) => ids[index] ?? [])
    follow.current = keep && head !== undefined ? { grip: head as NodeId } : "current"
    if (!strip.onMoveGroups(moved, at, side)) {
      follow.current = null
      return
    }
    pickIds(keep ? [] : movedIds)
    announce(gridMoveMessage(groups, moved, at, keep))
  }

  function add(index: number, side: "same" | "new") {
    if (strip.onAdd === undefined || count >= limits.slides) return
    follow.current = "current"
    dispatch({ kind: "pick", pick: null })
    strip.onAdd(undefined, index, side)
  }

  const onSet = slideSetAction(strip, held, {
    follow: () => {
      follow.current = "current"
    },
    pick: pickIds,
    moveSlides: (moved, at) => moveSlides(moved, at, "same"),
    announce,
  })

  function act(command: GridCommand, index: number) {
    if (command === "menu") return
    if (command === "open") {
      onOpen(index)
      return
    }
    if (held.length > 1 && held.includes(index)) {
      onSet(command)
      return
    }
    if (command === "up" || command === "down") {
      const at = setMoveAt([index], count, command)
      if (at !== null) moveSlides([index], at, "same")
      return
    }
    follow.current = "current"
    dispatch({ kind: "pick", pick: null })
    if (command === "clone") {
      strip.onClone?.(index)
      announce(slideListCopy.duplicated(index + 1))
      return
    }
    if (count < 2) {
      announce(slideListCopy.lastSlide)
      return
    }
    strip.onRemove?.(index)
    announce(slideListCopy.deleted(index + 1))
  }

  const menuHeld = menu === null ? [] : held.includes(menu.index) ? held : [menu.index]
  const below = menu === null ? null : moveBelowPlace(groups, menuHeld, menu.index)
  const menuSet: SlideMenuSet | undefined =
    menuHeld.length < 2
      ? undefined
      : {
          size: menuHeld.length,
          skipped: menuHeld.every((index) => strip.skipped?.[index] === true),
          allowed: (change) => {
            if (change === "up" || change === "down") return setMoveAt(menuHeld, count, change) !== null
            return change === "remove" ? menuHeld.length < count : menuHeld.length + count <= limits.slides
          },
        }

  return {
    held,
    menu,
    menuHeld,
    menuSet,
    full: count >= limits.slides,
    canMoveBelow: below !== null,
    moveSlides,
    add,
    act,
    openMenu: (index: number, anchor: SlideMenuAnchor, pointer: boolean) => {
      if (!held.includes(index)) {
        dispatch({ kind: "pick", pick: null })
        choose(index)
      }
      setMenu({ index, anchor, pointer })
    },
    closeMenu: (keyboard: boolean) => {
      const shown = menu
      setMenu(null)
      if (shown === null || follow.current !== null) return
      root.current
        ?.querySelector<HTMLElement>(`[data-slide-entry="${String(shown.index + 1)}"]`)
        ?.focus({ preventScroll: true, focusVisible: keyboard })
    },
    moveBelow: () => {
      if (menu !== null && below !== null) moveSlides(menuHeld, below, "new")
    },
  }
}
