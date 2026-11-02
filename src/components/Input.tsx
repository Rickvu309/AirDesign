import { useId, type ComponentProps } from "react";
import { Icon } from "../icons/Icon.js";
import type { IconName } from "../icons/icon-data.js";
import { cx } from "../lib/cx.js";

export type InputProps = Omit<ComponentProps<"input">, "size"> & {
  /** Visible or screen-reader label. Required for accessibility. */
  label: string;
  /** Hide the label visually but keep it for assistive tech. Default true (toolbar-style field). */
  labelHidden?: boolean;
  startIcon?: IconName;
  invalid?: boolean;
  /** Helper or error text under the field. */
  hint?: string;
};

export function Input({ label, labelHidden = true, startIcon, invalid, hint, className, id, disabled, ...rest }: InputProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const hintId = hint ? `${inputId}-hint` : undefined;
  return (
    <div className={cx("ad", className)} style={{ display: "grid", gap: 4 }}>
      <label htmlFor={inputId} style={labelHidden ? { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" } : { fontWeight: "var(--ad-weight-medium)" }}>
        {label}
      </label>
      <div className="ad-field" data-invalid={invalid || undefined} data-disabled={disabled || undefined}>
        {startIcon && <Icon name={startIcon} />}
        <input id={inputId} className="ad-input" disabled={disabled} aria-invalid={invalid || undefined} aria-describedby={hintId} {...rest} />
      </div>
      {hint && (
        <span id={hintId} style={{ color: invalid ? "var(--ad-brand-strong)" : "var(--ad-ink-muted)" }}>
          {hint}
        </span>
      )}
    </div>
  );
}

export function SearchField(props: Omit<InputProps, "startIcon" | "type" | "label"> & { label?: string }) {
  return <Input label="Search" placeholder="Search" type="search" startIcon="search" {...props} />;
}
