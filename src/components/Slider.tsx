import { useId, useState, type ComponentProps, type CSSProperties } from "react";
import { cx } from "../lib/cx.js";

export type SliderProps = Omit<ComponentProps<"input">, "type" | "value" | "defaultValue" | "onChange" | "children"> & {
  label: string;
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  /** Show the current value at the right of the label. */
  showValue?: boolean;
  /** Format the shown value, e.g. (v) => `${v}%`. */
  format?: (value: number) => string;
};

export function Slider({ label, value, defaultValue = 0, onValueChange, showValue, format = String, min = 0, max = 100, step = 1, className, id, ...rest }: SliderProps) {
  const auto = useId();
  const sid = id ?? auto;
  const [inner, setInner] = useState(defaultValue);
  const current = value ?? inner;
  const pct = ((current - Number(min)) / (Number(max) - Number(min))) * 100;
  return (
    <div className={cx("ad ad-stack", className)}>
      <div className="ad-slider__head">
        <label htmlFor={sid} className="ad-label">{label}</label>
        {showValue && <output htmlFor={sid} className="ad-slider__value">{format(current)}</output>}
      </div>
      <input
        id={sid}
        type="range"
        className="ad-slider"
        min={min}
        max={max}
        step={step}
        value={current}
        style={{ "--ad-slider-fill": `${pct}%` } as CSSProperties}
        onChange={(e) => { const v = Number(e.target.value); if (value === undefined) setInner(v); onValueChange?.(v); }}
        {...rest}
      />
    </div>
  );
}
