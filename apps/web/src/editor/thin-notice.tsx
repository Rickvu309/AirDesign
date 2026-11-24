import { useEffect, useRef, type CSSProperties } from "react"
import { toast } from "@/components/ui/toast"
import { Toaster } from "@/components/ui/sonner"
import { ActionPill } from "@/components/ui/action-pill"
import { productCopy } from "@/copy/product-copy"
import { EditorToast, EditorToaster } from "@/editor/editor-toast"
import { pictureCopy } from "@/copy/picture-copy"
import { undoCopy } from "@/copy/undo-copy"
import { exportCopy } from "@/copy/export-copy"

export type ThinNotice =
  | "offline"
  | "unreached"
  | "import-failed"
  | "export-failed"
  | "picture-type"
  | "picture-size"
  | "picture-unread"
  | "undo-changed"
  | "redo-changed"
  | "set-aside"
  | "set-aside-one"
  | "text-refused"
  | "set-aside-too-large"
  | "storage-failed"
  | "too-large"
  | "newer"

const noticeId = "thin-notice"
const noticeWidth = "26rem"

function FailureNotice({
  text,
  action,
  onAct,
  error,
}: {
  text: string
  action: string
  onAct: () => void
  error: boolean
}) {
  const retry = useRef(onAct)
  useEffect(() => {
    retry.current = onAct
  })
  useEffect(() => {
    toast.custom(
      () => <ActionPill error={error} text={text} action={action} onAct={() => retry.current()} width={noticeWidth} />,
      {
        id: noticeId,
        duration: Number.POSITIVE_INFINITY,
        unstyled: true,
        style: {
          left: 0,
          width: noticeWidth,
          transition: "transform var(--ease-micro), opacity var(--ease-micro)",
        },
      },
    )
  }, [text, action, error])
  useEffect(
    () => () => {
      toast.dismiss(noticeId)
    },
    [],
  )
  return null
}

function StatusNotice({
  text,
  kind = "info",
  still = false,
}: {
  text: string
  kind?: "info" | "success" | "error"
  still?: boolean
}) {
  return <EditorToast kind={kind} text={text} place="canvas" still={still} host={false} />
}

export function ThinNoticeView({
  notice,
  onTryAgain,
}: {
  notice: ThinNotice | null
  onTryAgain: (notice: ThinNotice) => void
}) {
  return (
    <>
      <EditorToaster />
      <Toaster
        position="top-center"
        offset={{ top: 12 }}
        visibleToasts={1}
        style={{ "--width": noticeWidth } as CSSProperties}
      />
      <NoticeContent notice={notice} onTryAgain={onTryAgain} />
    </>
  )
}

function NoticeContent({
  notice,
  onTryAgain,
}: {
  notice: ThinNotice | null
  onTryAgain: (notice: ThinNotice) => void
}) {
  if (notice === null) return null
  if (notice === "offline") return <StatusNotice text={productCopy.editorOffline} />
  if (notice === "unreached") return <StatusNotice text={productCopy.editorUnreached} />
  if (notice === "set-aside") return <StatusNotice kind="error" text={productCopy.editsSetAside} />
  if (notice === "set-aside-one") return <StatusNotice kind="error" text={productCopy.editSetAside} />
  if (notice === "text-refused") return <StatusNotice kind="error" text={productCopy.textRefused} />
  if (notice === "set-aside-too-large") return <StatusNotice kind="error" text={productCopy.editSetAsideTooLarge} />
  if (notice === "storage-failed") return <StatusNotice kind="error" text={productCopy.storageFailed} />
  if (notice === "too-large")
    return (
      <FailureNotice
        error
        text={productCopy.editsTooLarge}
        action={exportCopy.action}
        onAct={() => onTryAgain(notice)}
      />
    )
  if (notice === "undo-changed") return <StatusNotice still text={undoCopy.undoChanged} />
  if (notice === "redo-changed") return <StatusNotice still text={undoCopy.redoChanged} />
  if (notice === "picture-type" || notice === "picture-size" || notice === "picture-unread")
    return <StatusNotice text={pictureCopy[notice]} />
  if (notice === "newer") {
    return (
      <FailureNotice
        error={false}
        text={productCopy.newerVersion}
        action={productCopy.reload}
        onAct={() => onTryAgain(notice)}
      />
    )
  }
  if (notice === "import-failed") {
    return (
      <FailureNotice
        error
        text={productCopy.deckOpenFailed}
        action={productCopy.goToDecks}
        onAct={() => onTryAgain(notice)}
      />
    )
  }
  return (
    <FailureNotice
      error
      text={productCopy.exportFailed}
      action={exportCopy.tryAgain}
      onAct={() => onTryAgain(notice)}
    />
  )
}
