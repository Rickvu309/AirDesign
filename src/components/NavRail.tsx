import type { ComponentProps, ReactNode } from "react";
import { Icon } from "../icons/Icon.js";
import type { IconName } from "../icons/icon-data.js";
import { cx } from "../lib/cx.js";

/** Vertical rail of icon-over-label destinations, as in an editor's left edge. */
export function NavRail({ label, className, ...rest }: ComponentProps<"nav"> & { label: string }) {
  return <nav aria-label={label} className={cx("ad ad-rail", className)} {...rest} />;
}

export type NavRailItemProps = ComponentProps<"button"> & { icon: IconName; active?: boolean; children: ReactNode };

export function NavRailItem({ icon, active, className, children, type = "button", ...rest }: NavRailItemProps) {
  return (
    <button type={type} aria-pressed={active} className={cx("ad-rail__item", className)} {...rest}>
      <span className="ad-rail__icon"><Icon name={icon} size={20} /></span>
      <span className="ad-rail__label">{children}</span>
    </button>
  );
}
