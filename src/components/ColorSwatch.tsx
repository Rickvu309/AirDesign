import type { ComponentProps, CSSProperties } from "react";
import { cx } from "../lib/cx.js";

export type ColorSwatchProps = Omit<ComponentProps<"button">, "children" | "aria-label"> & {
  /** Any CSS colour. */
  color: string;
  /** Colour name for assistive tech, e.g. "Brand orange". */
  label: string;
  selected?: boolean;
  size?: number;
};

export function ColorSwatch({ color, label, selected, size = 24, className, style, ...rest }: ColorSwatchProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={selected}
      className={cx("ad ad-swatch", className)}
      style={{ "--ad-swatch": color, width: size, height: size, ...style } as CSSProperties}
      {...rest}
    />
  );
}
