import { useId, type ComponentProps } from "react";
import { cx } from "../lib/cx.js";

export type TextareaProps = ComponentProps<"textarea"> & {
  label: string;
  labelHidden?: boolean;
  invalid?: boolean;
  hint?: string;
};

export function Textarea({ label, labelHidden = false, invalid, hint, className, id, disabled, rows = 3, ...rest }: TextareaProps) {
  const auto = useId();
  const fid = id ?? auto;
  const hintId = hint ? `${fid}-hint` : undefined;
  return (
    <div className={cx("ad ad-stack", className)}>
      <label htmlFor={fid} className={labelHidden ? "ad-sr-only" : "ad-label"}>{label}</label>
      <div className="ad-field ad-field--multi" data-invalid={invalid || undefined} data-disabled={disabled || undefined}>
        <textarea id={fid} rows={rows} className="ad-input ad-textarea" disabled={disabled} aria-invalid={invalid || undefined} aria-describedby={hintId} {...rest} />
      </div>
      {hint && <span id={hintId} className={invalid ? "ad-hint ad-hint--error" : "ad-hint"}>{hint}</span>}
    </div>
  );
}
