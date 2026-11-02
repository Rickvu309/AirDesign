import type { ComponentProps, ReactNode } from "react";
import { Icon } from "../icons/Icon.js";
import type { IconName } from "../icons/icon-data.js";
import { cx } from "../lib/cx.js";

export type ButtonProps = ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  iconStart?: IconName;
  iconEnd?: IconName;
  /** Shows a spinner, sets aria-busy and blocks clicks. */
  loading?: boolean;
  children?: ReactNode;
};

export function Button({ variant = "secondary", size = "md", iconStart, iconEnd, loading, disabled, className, children, type = "button", onClick, ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx("ad ad-btn", `ad-btn--${variant}`, size === "sm" && "ad-btn--sm", className)}
      disabled={disabled}
      aria-busy={loading || undefined}
      onClick={loading ? undefined : onClick}
      {...rest}
    >
      {loading ? <span className="ad-spinner" aria-hidden="true" /> : iconStart && <Icon name={iconStart} />}
      {children}
      {iconEnd && <Icon name={iconEnd} />}
    </button>
  );
}
