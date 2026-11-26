import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from "react"
import { createPortal } from "react-dom"
import * as doom from "@airdesign/doom"
import { SlidePaint, useIcons } from "@airdesign/render"
import { EditorIcon } from "@/components/ui/editor-icons"
import type { LayoutChoice, ListedStart } from "@/editing/slide-layout"
import type { LayoutPicture, LayoutPictureSource } from "@/editor/layout-pictures"
import { composing } from "@/lib/composing"

const thumbWidth = 84

const opens = new Set(["Enter", " ", "ArrowDown", "ArrowUp"])

const row =
  "flex h-auto w-full items-center gap-2 rounded-md py-1 pr-2 pl-1 text-left text-[length:var(--type-dense)] text-white hover:bg-quiet hover:text-white focus:bg-quiet focus:text-white"

const triggerClass =
  "flex h-7 flex-1 items-center justify-center gap-1 rounded-l-lg text-[length:var(--type-dense)] text-foreground hover:bg-black/4"

function iconNames(nodes: readonly doom.Resolved[]): readonly string[] {
  return nodes.flatMap((node) => [
    ...(node.geometry?.kind === "icon" ? [node.geometry.name] : []),
    ...iconNames(node.children),
  ])
}

const thumbFrame =
  "pointer-events-none block shrink-0 overflow-hidden rounded-xs outline outline-white/15 -outline-offset-1"

function thumbHeight(size: { readonly w: number; readonly h: number }): number {
  return Math.round((thumbWidth * size.h) / size.w)
}

function PendingThumb({ size }: { readonly size: { readonly w: number; readonly h: number } }) {
  return (
    <span
      aria-hidden="true"
      data-layout-thumb-pending=""
      className={thumbFrame}
      style={{ width: thumbWidth, height: thumbHeight(size) }}
    />
  )
}

function LayoutThumb({ picture, iconsReady }: { readonly picture: LayoutPicture; readonly iconsReady: boolean }) {
  const height = thumbHeight(picture.size)
  return (
    <span
      aria-hidden="true"
      data-layout-thumb=""
      className={thumbFrame}
      style={{ width: thumbWidth, height, contain: "strict" }}
    >
      <span data-fonts-pending={iconsReady ? undefined : ""}>
        <SlidePaint
          nodes={picture.nodes}
          background={picture.background}
          size={picture.size}
          width={thumbWidth}
          iconsReady={iconsReady}
        />
      </span>
    </span>
  )
}

function Label(): ReactNode {
  return (
    <>
      New slide
      <EditorIcon name="chev" size={13} tone="quiet" />
    </>
  )
}

function setShown(menu: HTMLElement, trigger: HTMLElement, open: boolean) {
  menu.hidden = !open
  menu.toggleAttribute("data-open", open)
  menu.style.visibility = open ? "visible" : "hidden"
  trigger.setAttribute("aria-expanded", open ? "true" : "false")
}

function moveFocus(menu: HTMLElement, delta: number) {
  const items = [...menu.querySelectorAll<HTMLElement>("[role=menuitem]")]
  const at = items.indexOf(document.activeElement as HTMLElement)
  const next = at < 0 ? (delta > 0 ? 0 : items.length - 1) : (at + delta + items.length) % items.length
  items[next]?.focus()
}

function focusEdge(menu: HTMLElement, edge: "first" | "last") {
  const items = menu.querySelectorAll<HTMLElement>("[role=menuitem]")
  items[edge === "first" ? 0 : items.length - 1]?.focus()
}

export function NewSlideMenu({
  layouts,
  source,
  onChoose,
}: {
  layouts: readonly LayoutChoice[]
  source?: LayoutPictureSource
  onChoose: (part: ListedStart) => void
}) {
  const pictures = source?.pictures ?? null
  const warm = source?.warm
  const iconsReady = useIcons(
    pictures === null ? [] : doom.slideStarts.flatMap((part) => iconNames(pictures[part].nodes)),
  )
  const root = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const close = useCallback((returnFocus: boolean) => {
    const menu = panel.current
    const trigger = root.current?.querySelector("button")
    if (menu === null || !(trigger instanceof HTMLElement)) return
    setShown(menu, trigger, false)
    if (returnFocus) trigger.focus()
  }, [])
  const open = useCallback(
    (edge: "panel" | "first" | "last") => {
      const menu = panel.current
      const trigger = root.current?.querySelector("button")
      if (menu === null || !(trigger instanceof HTMLElement)) return
      setShown(menu, trigger, true)
      warm?.()
      if (edge === "panel") menu.focus()
      else focusEdge(menu, edge)
    },
    [warm],
  )
  useLayoutEffect(() => {
    const menu = panel.current
    const trigger = root.current?.querySelector("button")
    if (menu === null || !(trigger instanceof HTMLElement)) return
    menu.style.setProperty("display", "flex", "important")
    const place = () => {
      const rect = trigger.getBoundingClientRect()
      const top = `${rect.bottom + 4}px`
      const left = `${rect.left}px`
      if (menu.style.top !== top) menu.style.top = top
      if (menu.style.left !== left) menu.style.left = left
    }
    place()
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place)
    observer?.observe(trigger)
    window.addEventListener("resize", place)
    return () => {
      observer?.disconnect()
      window.removeEventListener("resize", place)
    }
  }, [layouts.length])
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const menu = panel.current
      const trigger = root.current?.querySelector("button")
      if (menu === null || !(trigger instanceof HTMLElement) || menu.hidden) return
      const target = event.target
      if (target instanceof Node && (root.current?.contains(target) || menu.contains(target))) return
      close(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (composing(event)) return
      if (event.key !== "Escape" || panel.current === null || panel.current.hidden) return
      close(true)
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [close])
  if (layouts.length === 0) {
    return (
      <span className="flex flex-1 items-center justify-center gap-1 text-[length:var(--type-dense)] text-foreground">
        <Label />
      </span>
    )
  }
  return (
    <div ref={root} className="flex flex-1">
      <button
        type="button"
        className={triggerClass}
        aria-label="Choose a layout for the new slide"
        aria-haspopup="menu"
        aria-expanded="false"
        data-new-slide-layouts
        onPointerEnter={warm}
        onFocus={warm}
        onPointerDown={(event) => {
          if (event.button !== 0) return
          const menu = panel.current
          if (menu === null) return
          event.preventDefault()
          if (menu.hidden) open("panel")
          else close(false)
        }}
        onClick={(event) => {
          if (event.detail !== 0 || panel.current === null) return
          if (panel.current.hidden) open("first")
          else close(false)
        }}
        onKeyDown={(event) => {
          if (composing(event) || !opens.has(event.key)) return
          event.preventDefault()
          open(event.key === "ArrowUp" ? "last" : "first")
        }}
      >
        <Label />
      </button>
      {typeof document === "undefined"
        ? null
        : createPortal(
            <div
              ref={panel}
              role="menu"
              aria-label="New slide"
              hidden
              tabIndex={-1}
              data-layout-menu=""
              className="fixed z-50 w-57 flex-col overscroll-contain overflow-y-auto rounded-xl bg-foreground p-1.5 text-white shadow-[0px_8px_24px_var(--black-20)] ring-0"
              onKeyDown={(event) => {
                if (composing(event) || panel.current === null) return
                if (event.key === "Tab") return close(true)
                if (event.key === "Home" || event.key === "End") {
                  event.preventDefault()
                  return focusEdge(panel.current, event.key === "Home" ? "first" : "last")
                }
                if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return
                event.preventDefault()
                moveFocus(panel.current, event.key === "ArrowDown" ? 1 : -1)
              }}
            >
              {layouts.map((layout) => {
                const picture = pictures?.[layout.part]
                return (
                  <button
                    key={layout.part}
                    type="button"
                    role="menuitem"
                    data-layout={layout.part}
                    className={row}
                    onClick={() => {
                      close(true)
                      onChoose(layout.part)
                    }}
                  >
                    {picture !== undefined ? (
                      <LayoutThumb picture={picture} iconsReady={iconsReady} />
                    ) : source === undefined ? null : (
                      <PendingThumb size={source.size} />
                    )}
                    <span className="min-w-0 flex-1 truncate">{layout.name}</span>
                  </button>
                )
              })}
            </div>,
            document.body,
          )}
    </div>
  )
}
