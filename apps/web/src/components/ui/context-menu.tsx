"use client"

import { useCallback, useLayoutEffect, useState } from "react"
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu"
import { cn } from "@/lib/class-names"

function ContextMenu({ ...props }: ContextMenuPrimitive.Root.Props) {
  return <ContextMenuPrimitive.Root data-slot="context-menu" {...props} />
}

function ContextMenuTrigger({ ...props }: ContextMenuPrimitive.Trigger.Props) {
  return <ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...props} />
}

function ContextMenuContent({
  className,
  anchor,
  side,
  align,
  sideOffset,
  ref,
  ...props
}: ContextMenuPrimitive.Popup.Props &
  Pick<ContextMenuPrimitive.Positioner.Props, "anchor" | "side" | "align" | "sideOffset">) {
  const [popup, setPopup] = useState<HTMLDivElement | null>(null)
  const attachPopup = useCallback(
    (element: HTMLDivElement | null) => {
      setPopup(element)
      if (typeof ref === "function") return ref(element)
      if (ref) ref.current = element
    },
    [ref],
  )
  useLayoutEffect(() => {
    if (!popup) return
    queueMicrotask(() => {
      if (popup.isConnected && !popup.contains(popup.ownerDocument.activeElement)) popup.focus({ preventScroll: true })
    })
  }, [popup])
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Positioner
        className="isolate z-50 outline-none"
        anchor={anchor}
        side={side}
        align={align}
        sideOffset={sideOffset}
      >
        <ContextMenuPrimitive.Popup
          ref={attachPopup}
          data-slot="context-menu-content"
          className={cn(
            "z-50 min-w-56 origin-(--transform-origin) overflow-hidden rounded-lg bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none",
            className,
          )}
          {...props}
        />
      </ContextMenuPrimitive.Positioner>
    </ContextMenuPrimitive.Portal>
  )
}

function ContextMenuItem({ className, ...props }: ContextMenuPrimitive.Item.Props) {
  return (
    <ContextMenuPrimitive.Item
      data-slot="context-menu-item"
      className={cn(
        "flex cursor-default items-center gap-4 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

function ContextMenuSeparator({ className, ...props }: ContextMenuPrimitive.Separator.Props) {
  return (
    <ContextMenuPrimitive.Separator
      data-slot="context-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

export { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger }
