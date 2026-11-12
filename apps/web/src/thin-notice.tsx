import { useEffect, useRef, type CSSProperties } from "react"
import { toast } from "sonner"
import { Toaster } from "@/components/ui/sonner"
import { StatusPill } from "@/components/ui/status-pill"
import { productCopy } from "@/copy/product-copy"
import { EditorToast } from "@/editor/agent-panel"
import { exportCopy } from "@/export/export-options"

export type ThinNotice = "offline" | "import-failed" | "export-failed"

const noticeId = "thin-notice"
const noticeWidth = "24rem"

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

function OfflineNotice() {
  useEffect(
    () => () => {
      toast.dismiss("editor-status")
    },
    [],
  )
  return <EditorToast kind="info" text={productCopy.editorOffline} place="canvas" />
}

export function ThinNoticeView({
  notice,
  onTryAgain,
}: {
  notice: ThinNotice | null
  onTryAgain: (notice: ThinNotice) => void
}) {
  if (notice === null) return null
  if (notice === "offline") return <OfflineNotice />
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
