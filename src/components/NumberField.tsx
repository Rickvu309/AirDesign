import { useId, type ComponentProps } from "react";
import { cx } from "../lib/cx.js";

export type NumberFieldProps = Omit<ComponentProps<"input">, "type" | "children"> & {
  /** Accessible name, e.g. "Width". */
  label: string;
  /** Short visible prefix inside the field, e.g. "W" or "X". */
  prefix?: string;
};

/** Compact numeric input for property panels. */
export function NumberField({ label, prefix, className, id, ...rest }: NumberFieldProps) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className={cx("ad ad-field ad-numberfield", className)}>
      <label htmlFor={fid} className={prefix ? "ad-numberfield__prefix" : "ad-sr-only"} aria-label={label} title={label}>{prefix ?? label}</label>
      <input id={fid} type="number" className="ad-input" {...rest} />
    </div>
  );
}
