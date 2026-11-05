import { useEffect, useId, useRef } from "react"

type AlertDialogProps = {
  open: boolean
  title: string
  body: string
  onClose: () => void
  primary?: { label: string; onClick: () => void; danger?: boolean }
  secondary?: { label: string }
}

export function AlertDialog({ open, title, body, onClose, primary, secondary }: AlertDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const titleId = useId()
  const bodyId = useId()

  useEffect(() => {
    if (!open) {
      return
    }
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const panel = panelRef.current
    const focusable = focusableItems(panel)
    ;(focusable[0] ?? panel)?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== "Tab" || !panel) {
        return
      }
      const items = focusableItems(panel)
      const first = items[0]
      const last = items[items.length - 1]
      if (!first || !last) {
        return
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      restoreRef.current?.focus()
    }
  }, [open])

  if (!open) {
    return null
  }

  return (
    <div className="ad-scrim">
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId} tabIndex={-1} className="ad-dialog">
        <h2 id={titleId} className="ad-dialog-title">{title}</h2>
        <p id={bodyId} className="ad-dialog-body">{body}</p>
        <div className="ad-dialog-actions">
          {secondary ? <button type="button" className="ad-button ad-button-secondary ad-button-dialog" onClick={() => onCloseRef.current()}>{secondary.label}</button> : null}
          {primary ? <button type="button" className={`ad-button ad-button-dialog ${primary.danger ? "ad-button-danger" : "ad-button-primary"}`} onClick={primary.onClick}>{primary.label}</button> : null}
        </div>
      </div>
    </div>
  )
}

function focusableItems(panel: HTMLDivElement | null): HTMLElement[] {
  if (!panel) {
    return []
  }
  return [...panel.querySelectorAll<HTMLElement>("button, [href], input, select, textarea")]
}
