import { useEffect, useRef, type ComponentProps } from "react";
import { Icon } from "../icons/Icon.js";
import { cx } from "../lib/cx.js";

export type CheckboxProps = Omit<ComponentProps<"input">, "type" | "children"> & {
  label: string;
  /** Mixed state, shown as a dash. Set by you; the browser clears it on click. */
  indeterminate?: boolean;
};

export function Checkbox({ label, indeterminate, className, ...rest }: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = !!indeterminate; }, [indeterminate]);
  return (
    <label className={cx("ad ad-check", className)}>
      <input ref={ref} type="checkbox" className="ad-check__input" {...rest} />
      <span className="ad-check__box" aria-hidden="true">
        <Icon name="check" size={12} className="ad-check__tick" />
        <Icon name="minus" size={12} className="ad-check__dash" />
      </span>
      <span>{label}</span>
    </label>
  );
}
