import { useState, type ReactNode } from "react";
import { Button } from "../components/Button.js";
import { ChatComposer } from "../components/Chat.js";
import { Dialog, type DialogProps } from "../components/Dialog.js";
import { IconButton } from "../components/IconButton.js";
import { cx } from "../lib/cx.js";

export type GettingStartedDialogProps = Omit<DialogProps, "title" | "children"> & {
  title?: ReactNode;
  onStartFromScratch?: () => void;
  onUseTemplate?: () => void;
  composerValue?: string;
  onComposerChange?: (value: string) => void;
  onComposerSend?: (text: string) => void;
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

export function GettingStartedDialog({
  title = defaultTitle,
  open,
  onClose,
  onStartFromScratch,
  onUseTemplate,
  composerValue,
  onComposerChange,
  onComposerSend,
  className,
  ...rest
}: GettingStartedDialogProps) {
  const [internalValue, setInternalValue] = useState("");
  const value = composerValue !== undefined ? composerValue : internalValue;
  const setValue = onComposerChange ?? setInternalValue;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      className={cx("start", className)}
      initialFocus="dialog"
      {...rest}
    >
      <div className="start__body">
        <h2>What would you like to present?</h2>
        <ChatComposer
          value={value}
          onValueChange={setValue}
          onSend={(text) => {
            onComposerSend?.(text);
            if (composerValue === undefined) setValue("");
          }}
          placeholder="Add your thoughts, notes, or outline to start building your first draft"
          label="Describe your deck"
          tools={
            <>
              <IconButton icon="plus" label="Add context" size="sm" />
              <Button size="sm" variant="secondary" iconStart="palette">
                Select deck template
              </Button>
            </>
          }
        />
        <div className="start__cards">
          <button type="button" className="start__card" onClick={onStartFromScratch}>
            <b>Start from scratch</b>
            <span>Build using empty slides</span>
            <i className="ill ill--a" />
          </button>
          <button type="button" className="start__card" onClick={onUseTemplate}>
            <b>Use a template</b>
            <span>Browse AirDesign and team-made decks</span>
            <i className="ill ill--b" />
          </button>
        </div>
      </div>
    </Dialog>
  );
}
