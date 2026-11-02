import type { ComponentProps } from "react";
import { cx } from "./cx.ts";

export type SwitchProps = Omit<ComponentProps<"button">, "onChange" | "children" | "aria-label"> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Accessible name. */
  label: string;
};

export function Switch({ checked, onCheckedChange, label, className, ...rest }: SwitchProps) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className={cx("ad ad-switch", className)} onClick={() => onCheckedChange(!checked)} {...rest} />;
}
