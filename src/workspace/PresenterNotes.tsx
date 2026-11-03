import type { ComponentProps } from "react";
import { Button } from "../components/Button.js";
import { cx } from "../lib/cx.js";

export type PresenterNotesProps = ComponentProps<"div"> & {
  placeholder?: string;
  onDraftWithAi?: () => void;
};

export function PresenterNotes({
  placeholder = "Add presenter notes...",
  onDraftWithAi,
  className,
  ...rest
}: PresenterNotesProps) {
  return (
    <div className={cx("notes", className)} {...rest}>
      <div className="notes__grip" />
      <div className="notes__box">
        <span>{placeholder}</span>
        <Button size="sm" variant="ghost" iconStart="text" onClick={onDraftWithAi}>
          Start with a draft <b>AI</b>
        </Button>
      </div>
    </div>
  );
}
