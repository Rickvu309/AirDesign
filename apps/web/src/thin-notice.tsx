import { useEffect, useRef, type CSSProperties } from "react"
import { toast } from "@/components/ui/toast"
import { Toaster } from "@/components/ui/sonner"
import { StatusPill } from "@/components/ui/status-pill"
import { downloadedOf, productCopy } from "@/copy/product-copy"
import { EditorToast, EditorToaster } from "@/editor/agent-panel"
import { pictureCopy } from "@/copy/picture-copy"
import { undoCopy } from "@/copy/undo-copy"
import { exportCopy } from "@/export/export-options"

export type ThinNotice =
  | "offline"
  | "unreached"
  | "import-failed"
  | "export-failed"
  | "picture-uploading"
  | "picture-type"
  | "picture-size"
  | "picture-unread"
  | "undo-changed"
  | "redo-changed"
  | "set-aside"
  | "set-aside-too-large"
  | "storage-failed"
  | "too-large"
  | "newer"

const noticeId = "thin-notice"
const noticeWidth = "24rem"
const downloadedFor = 4000

export function signInAddress(page: { readonly pathname: string; readonly search: string }): string {
  const base = import.meta.env.VITE_SIGN_IN_URL ?? "/sign-in"
  return `${base}?next=${encodeURIComponent(`${page.pathname}${page.search}`)}`
}

export function ActionPill({
  text,
  action,
  onAct,
  width,
}: {
  text: string
  action: string
  onAct: () => void
  width: string
}) {
  return (
    <StatusPill className="max-w-full gap-2.5 pr-1.5 pl-3.5" style={{ width }}>
      <span className="min-w-0 flex-1 truncate">{text}</span>
      <button
        type="button"
        className="flex h-7 shrink-0 items-center rounded-md px-2.5 font-medium whitespace-nowrap"
        onClick={onAct}
      >
        {action}
      </button>
    </StatusPill>
  )
}

function FailureNotice({ text, action, onAct }: { text: string; action: string; onAct: () => void }) {
  const retry = useRef(onAct)
  useEffect(() => {
    retry.current = onAct
  })
  useEffect(() => {
    toast.custom(() => <ActionPill text={text} action={action} onAct={() => retry.current()} width={noticeWidth} />, {
      id: noticeId,
      duration: Number.POSITIVE_INFINITY,
      unstyled: true,
      style: {
        left: 0,
        width: noticeWidth,
        transition: "transform var(--ease-micro), opacity var(--ease-micro)",
      },
    })
  }, [text, action])
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
  kind?: "info" | "success"
  still?: boolean
}) {
  return <EditorToast kind={kind} text={text} place="canvas" still={still} host={false} />
}

export function DownloadedNotice({ name, onDone }: { name: string; onDone: () => void }) {
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  })
  useEffect(() => {
    const timer = window.setTimeout(() => done.current(), downloadedFor)
    return () => window.clearTimeout(timer)
  }, [name])
  return <StatusNotice kind="success" text={downloadedOf(name)} />
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
  if (notice === "set-aside") return <StatusNotice text={productCopy.editsSetAside} />
  if (notice === "set-aside-too-large") return <StatusNotice text={productCopy.editSetAsideTooLarge} />
  if (notice === "storage-failed") return <StatusNotice text={productCopy.storageFailed} />
  if (notice === "too-large") return <StatusNotice text={productCopy.editsTooLarge} />
  if (notice === "undo-changed") return <StatusNotice still text={undoCopy.undoChanged} />
  if (notice === "redo-changed") return <StatusNotice still text={undoCopy.redoChanged} />
  if (notice === "picture-type" || notice === "picture-size" || notice === "picture-unread")
    return <StatusNotice text={pictureCopy[notice]} />
  if (notice === "newer") {
    return (
      <FailureNotice text={productCopy.newerVersion} action={productCopy.reload} onAct={() => onTryAgain(notice)} />
    )
  }
  if (notice === "import-failed") {
    return (
      <FailureNotice
        text={productCopy.deckOpenFailed}
        action={productCopy.goToDecks}
        onAct={() => onTryAgain(notice)}
      />
    )
  }
  const text = notice === "picture-uploading" ? pictureCopy.exportWaiting : productCopy.exportFailed
  return <FailureNotice text={text} action={exportCopy.tryAgain} onAct={() => onTryAgain(notice)} />
}
