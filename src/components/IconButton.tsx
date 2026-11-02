import type { ComponentProps } from "react";
import { Icon } from "../icons/Icon.js";
import type { IconName } from "../icons/icon-data.js";
import { cx } from "../lib/cx.js";

export type IconButtonProps = Omit<ComponentProps<"button">, "children" | "aria-label"> & {
  icon: IconName;
  /** Required: icon-only buttons need an accessible name. Also shown as the native tooltip. */
  label: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  /** Toggle state (sets aria-pressed). Leave undefined for a plain button. */
  pressed?: boolean;
};

export function IconButton({ icon, label, variant = "ghost", size = "md", pressed, className, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={cx("ad ad-btn ad-btn--icon", `ad-btn--${variant}`, size === "sm" && "ad-btn--sm", className)}
      {...rest}
    >
      <Icon name={icon} size={size === "sm" ? 14 : 16} />
    </button>
  );
}
