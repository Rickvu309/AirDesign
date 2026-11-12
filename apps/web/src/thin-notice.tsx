import { useEffect, useRef, type CSSProperties } from "react"
import { toast } from "sonner"
import { Toaster } from "@/components/ui/sonner"
import { StatusPill } from "@/components/ui/status-pill"
import { downloadedOf, productCopy } from "@/copy/product-copy"
import { EditorToast } from "@/editor/agent-panel"
import { undoCopy } from "@/copy/undo-copy"
import { exportCopy } from "@/export/export-options"

export type ThinNotice = "offline" | "import-failed" | "export-failed" | "undo-changed" | "redo-changed"

const noticeId = "thin-notice"
const noticeWidth = "24rem"
const downloadedFor = 4000

export function signInAddress(page: { readonly pathname: string; readonly search: string }): string {
  const base = import.meta.env.VITE_SIGN_IN_URL ?? "/sign-in"
  return `${base}?next=${encodeURIComponent(`${page.pathname}${page.search}`)}`
}

function FailureNotice({ text, action, onAct }: { text: string; action: string; onAct: () => void }) {
  const retry = useRef(onAct)
  useEffect(() => {
    retry.current = onAct
  })
  useEffect(() => {
    toast.custom(
      () => (
        <StatusPill className="gap-2.5 pr-1.5 pl-3.5" style={{ width: noticeWidth }}>
          <span className="min-w-0 flex-1 truncate">{text}</span>
          <button
            type="button"
            className="flex h-7 shrink-0 items-center rounded-md px-2.5 font-medium whitespace-nowrap"
            onClick={() => retry.current()}
          >
            {action}
          </button>
        </StatusPill>
      ),
      {
        id: noticeId,
        duration: Number.POSITIVE_INFINITY,
        unstyled: true,
        style: { left: 0, width: noticeWidth, opacity: 1, transform: "translateY(0)", transition: "none" },
      },
    )
    return () => {
      toast.dismiss(noticeId)
    }
  }, [text])
  return (
    <Toaster
      position="top-center"
      offset={{ top: 12 }}
      visibleToasts={1}
      style={{ "--width": noticeWidth } as CSSProperties}
    />
  )
}

function StatusNotice({ text, kind = "info" }: { text: string; kind?: "info" | "success" }) {
  useEffect(
    () => () => {
      toast.dismiss("editor-status")
    },
    [],
  )
  return <EditorToast kind={kind} text={text} place="canvas" />
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
  if (notice === null) return null
  if (notice === "offline") return <StatusNotice text={productCopy.editorOffline} />
  if (notice === "undo-changed") return <StatusNotice text={undoCopy.undoChanged} />
  if (notice === "redo-changed") return <StatusNotice text={undoCopy.redoChanged} />
  if (notice === "import-failed") {
    return (
      <FailureNotice
        text={productCopy.deckOpenFailed}
        action={productCopy.goToDecks}
        onAct={() => onTryAgain(notice)}
      />
    )
  }
  return <FailureNotice text={productCopy.exportFailed} action={exportCopy.tryAgain} onAct={() => onTryAgain(notice)} />
}
