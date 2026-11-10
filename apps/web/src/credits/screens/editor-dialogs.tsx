import type { ReactNode } from "react"
import { AddCreditsDialog } from "@/credits/add-credits-dialog"
import { lowBalanceEntry } from "@/credits/credits-sample"
import { LimitCover } from "@/credits/limit-panel"
import { ResetToast } from "@/credits/reset-toast"
import { ConfirmResetDialog } from "@/credits/screens/settings-dialogs"
import { galleryDeck } from "@/editor/gallery-deck"
import { SlideThumb } from "@/editor/slide-thumb"
import { EditorView } from "@/editor/screens/editor-view"

function EditorBackdrop({
  phase,
  toast,
  mark = "tile",
}: {
  phase: "limit" | "reset"
  toast?: ReactNode
  mark?: "tile" | "ring"
}) {
  return (
    <EditorView
      {...galleryDeck}
      run="done"
      toast={toast}
      overlay={
        <>
          <LimitCover phase={phase} mark={mark} />
          <div className="pointer-events-none absolute top-[802px] left-[42px] z-30">
            <SlideThumb index={6} width={180} queued />
          </div>
        </>
      }
    />
  )
}

export function LimitReached() {
  return <EditorBackdrop phase="limit" />
}

export function ConfirmReset() {
  return (
    <>
      <EditorBackdrop phase="limit" mark="ring" />
      <ConfirmResetDialog />
    </>
  )
}

export function AddCreditsFirst() {
  return (
    <>
      <EditorBackdrop phase="limit" />
      <AddCreditsDialog open {...lowBalanceEntry} />
    </>
  )
}

export function ResetComplete() {
  return <EditorBackdrop phase="reset" toast={<ResetToast />} />
}
