import type { ReactNode } from "react";
import { Button } from "../components/Button.js";
import { Dialog, type DialogProps } from "../components/Dialog.js";
import { Progress, Spinner } from "../components/Feedback.js";
import { cx } from "../lib/cx.js";

export type DraftingStateProps = Omit<DialogProps, "title" | "children"> & {
  title?: ReactNode;
  onCancel?: () => void;
  progress?: number;
};

const defaultTitle = (
  <span className="start__title">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path fill="#ff5c16" d="M0 5a5 5 0 0 1 5-5h14a5 5 0 0 1 5 5v14a5 5 0 0 1-5 5H5a5 5 0 0 1-5-5z" />
      <path
        fill="#fff"
        d="M17 6a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-1.68l.661 2.365a.5.5 0 1 1-.962.27L14.28 16H9.72l-.738 2.635a.5.5 0 0 1-.962-.27L8.68 16H7l-.204-.01A2 2 0 0 1 5 14V8a2 2 0 0 1 2-2zM7 7a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1zm1.5 4.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2m0-3a1 1 0 1 1 0 2 1 1 0 0 1 0-2"
      />
    </svg>
    Getting started
  </span>
);

export function DraftingState({
  title = defaultTitle,
  open,
  onClose,
  onCancel,
  progress = 42,
  className,
  ...rest
}: DraftingStateProps) {
  const handleCancel = onCancel ?? onClose;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      className={cx("start drafting-dialog", className)}
      initialFocus="dialog"
      {...rest}
    >
      <div className="drafting__body">
        <div className="drafting__spinner-wrap">
          <Spinner label="Drafting deck" />
        </div>
        <h2>Drafting your deck...</h2>
        <p className="drafting__desc">
          AI is analyzing your notes, generating slide structure, and designing layouts.
        </p>
        <div className="drafting__progress-wrap">
          <Progress label="Drafting progress" value={progress} />
        </div>
        <div className="drafting__actions">
          <Button variant="secondary" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
