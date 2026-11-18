import { useEffect, type CSSProperties, type RefObject } from "react"
import { toast } from "@/components/ui/toast"
import { Toaster } from "@/components/ui/sonner"
import { undoCopy } from "@/copy/undo-copy"
import { ActionPill } from "@/thin-notice"
import type { UndoEntry, UndoList } from "@/undo-list"

const toasterId = "slides"
const deletedId = "slide-deleted"
const deletedWidth = "18rem"
const held: { entry: UndoEntry | null } = { entry: null }

export type UndoOf = { readonly list: RefObject<UndoList>; readonly undo: () => void }

export function showSlideDeleted(message: string, entry: UndoEntry, undoOf: UndoOf): void {
  held.entry = entry
  toast.notice(
    () => (
      <div data-slide-toast>
        <ActionPill
          text={message}
          action={undoCopy.undo}
          width={deletedWidth}
          onAct={() => {
            toast.dismiss(deletedId)
            held.entry = null
            if (undoOf.list.current.undo.at(-1) === entry) undoOf.undo()
          }}
        />
      </div>
    ),
    {
      id: deletedId,
      toasterId,
      unstyled: true,
      style: { left: 0, width: deletedWidth, opacity: 1, transform: "translateY(0)", transition: "none" },
    },
  )
}

export function SlideToaster({ list }: { list: RefObject<UndoList> }) {
  useEffect(() => {
    if (held.entry === null || list.current.undo.at(-1) === held.entry) return
    held.entry = null
    toast.dismiss(deletedId)
  })
  return (
    <Toaster
      id={toasterId}
      position="top-center"
      offset={{ top: 12 }}
      visibleToasts={1}
      style={{ "--width": deletedWidth } as CSSProperties}
      className="min-[601px]:![left:calc(50%-56px)]"
    />
  )
}
