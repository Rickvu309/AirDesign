import { useEffect, useId, useRef, type ComponentProps, type ReactNode } from "react";
import { IconButton } from "./IconButton.js";
import { cx } from "../lib/cx.js";

export type DialogProps = Omit<ComponentProps<"dialog">, "title" | "open" | "onClose"> & {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Buttons for the footer, usually a primary and a secondary Button. */
  actions?: ReactNode;
  /** Where focus lands on open: the first control (default) or the dialog itself, which avoids a focus ring on an arbitrary button. */
  initialFocus?: "first" | "dialog";
};

/** Modal built on the native dialog element: focus trap, Escape and backdrop are handled by the browser. */
export function Dialog({ open, onClose, title, actions, initialFocus = "first", className, children, ...rest }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) { el.showModal(); if (initialFocus === "dialog") el.focus(); }
    if (!open && el.open) el.close();
  }, [open, initialFocus]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      tabIndex={initialFocus === "dialog" ? -1 : undefined}
      className={cx("ad ad-dialog", className)}
      onClose={() => {
        if (!open) return;
        onClose();
      }}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      {...rest}
    >
      <div className="ad-dialog__header">
        <h2 id={titleId} className="ad-dialog__title">{title}</h2>
        <IconButton icon="close" label="Close" size="sm" onClick={onClose} />
      </div>
      <div className="ad-dialog__body">{children}</div>
      {actions && <div className="ad-dialog__footer">{actions}</div>}
    </dialog>
  );
}
