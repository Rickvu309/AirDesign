import type { ReactNode } from "react"
import { AddCreditsDialog } from "@/credits/add-credits-dialog"
import { lowBalanceEntry } from "@/credits/credits-sample"
import { LimitCover } from "@/credits/limit-panel"
import { ResetToast } from "@/credits/reset-toast"
import { ConfirmResetDialog } from "@/credits/screens/settings-dialogs"
import { EditorSample } from "@/doom-editor/editor-sample"

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
    <EditorSample start={{ panel: "agent" }}>
      {toast}
      <LimitCover phase={phase} mark={mark} />
    </EditorSample>
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
