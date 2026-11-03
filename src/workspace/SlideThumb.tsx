import type { ComponentProps } from "react";
import { cx } from "../lib/cx.js";

export type SlideThumbProps = ComponentProps<"div"> & {
  title?: string;
  sub?: boolean;
  selected?: boolean;
  n?: number;
  empty?: boolean;
};

export function SlideThumb({
  title = "Slide Deck Title",
  sub = true,
  selected,
  n,
  empty,
  className,
  ...rest
}: SlideThumbProps) {
  return (
    <div className={cx("thumb", className)} data-selected={selected || undefined} {...rest}>
      {n !== undefined && <span className="thumb__n">{n}</span>}
      {!empty && (
        <div className="thumb__body">
          <b>{title}</b>
          {sub && <i />}
        </div>
      )}
    </div>
  );
}
