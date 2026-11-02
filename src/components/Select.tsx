import { useId, type ComponentProps } from "react";
import { Icon } from "../icons/Icon.js";
import { cx } from "../lib/cx.js";

export interface SelectOption { value: string; label: string; disabled?: boolean }
export type SelectProps = Omit<ComponentProps<"select">, "children"> & {
  label: string;
  labelHidden?: boolean;
  options: SelectOption[];
  invalid?: boolean;
  hint?: string;
};

/** Styled native select: keeps mobile pickers, type-ahead and form behaviour. */
export function Select({ label, labelHidden = false, options, invalid, hint, className, id, disabled, ...rest }: SelectProps) {
  const auto = useId();
  const fid = id ?? auto;
  const hintId = hint ? `${fid}-hint` : undefined;
  return (
    <div className={cx("ad ad-stack", className)}>
      <label htmlFor={fid} className={labelHidden ? "ad-sr-only" : "ad-label"}>{label}</label>
      <div className="ad-field ad-field--select" data-invalid={invalid || undefined} data-disabled={disabled || undefined}>
        <select id={fid} className="ad-input ad-select" disabled={disabled} aria-invalid={invalid || undefined} aria-describedby={hintId} {...rest}>
          {options.map((o) => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
        </select>
        <Icon name="chevron-down" className="ad-select__chevron" />
      </div>
      {hint && <span id={hintId} className={invalid ? "ad-hint ad-hint--error" : "ad-hint"}>{hint}</span>}
    </div>
  );
}
