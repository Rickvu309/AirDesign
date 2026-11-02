import { cloneElement, useId, type ReactElement, type ReactNode } from "react";
import { cx } from "../lib/cx.js";

export interface PopoverProps {
  /** A button. It gets popoverTarget wired to the panel. */
  trigger: ReactElement<{ popoverTarget?: string }>;
  /** Accessible name for the panel. */
  label: string;
  children: ReactNode;
  className?: string;
}

/** Built on the native Popover API: light dismiss, Escape, top-layer stacking, no positioning script. */
export function Popover({ trigger, label, children, className }: PopoverProps) {
  const id = useId();
  return (
    <>
      {cloneElement(trigger, { popoverTarget: id })}
      <div id={id} popover="auto" role="dialog" aria-label={label} className={cx("ad ad-popover", className)}>
        {children}
      </div>
    </>
  );
}
