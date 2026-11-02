import { useId, useState, type ReactNode } from "react";
import { cx } from "../lib/cx.js";

export interface RadioOption { value: string; label: ReactNode; disabled?: boolean }
export interface RadioGroupProps {
  /** Group name, announced as the legend. */
  label: string;
  options: RadioOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  orientation?: "vertical" | "horizontal";
  className?: string;
}

/** Native radios in a fieldset: arrow-key navigation and form submission come from the browser. */
export function RadioGroup({ label, options, value, defaultValue, onValueChange, name, orientation = "vertical", className }: RadioGroupProps) {
  const auto = useId();
  const [inner, setInner] = useState(defaultValue);
  const current = value ?? inner;
  return (
    <fieldset className={cx("ad ad-radiogroup", `ad-radiogroup--${orientation}`, className)}>
      <legend className="ad-radiogroup__legend">{label}</legend>
      {options.map((o) => (
        <label key={o.value} className="ad-radio">
          <input
            type="radio"
            className="ad-radio__input"
            name={name ?? auto}
            value={o.value}
            checked={current === o.value}
            disabled={o.disabled}
            onChange={() => { if (value === undefined) setInner(o.value); onValueChange?.(o.value); }}
          />
          <span className="ad-radio__dot" aria-hidden="true" />
          <span>{o.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
