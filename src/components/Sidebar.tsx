import type { ComponentProps, ReactNode } from "react";
import { Icon } from "../icons/Icon.js";
import type { IconName } from "../icons/icon-data.js";
import { cx } from "../lib/cx.js";

export function Sidebar({ label, className, ...rest }: ComponentProps<"nav"> & { label: string }) {
  return <nav aria-label={label} className={cx("ad ad-sidebar", className)} {...rest} />;
}

export function SidebarSection({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <div className="ad-sidebar__section">
      {title && <div className="ad-sidebar__title">{title}</div>}
      {children}
    </div>
  );
}

export type SidebarItemProps = ComponentProps<"a"> & {
  icon?: IconName | ReactNode;
  /** Marks the current page (aria-current). */
  active?: boolean;
  /** Trailing count or badge. */
  trailing?: ReactNode;
};

export function SidebarItem({ icon, active, trailing, className, children, ...rest }: SidebarItemProps) {
  return (
    <a aria-current={active ? "page" : undefined} className={cx("ad-sidebar__item", className)} {...rest}>
      {icon && (
        <span className="ad-sidebar__icon">
          {typeof icon === "string" ? <Icon name={icon as IconName} size={20} /> : icon}
        </span>
      )}
      <span className="ad-sidebar__label">{children}</span>
      {trailing && <span className="ad-sidebar__trailing">{trailing}</span>}
    </a>
  );
}
