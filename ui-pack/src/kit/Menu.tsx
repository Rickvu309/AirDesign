import type { ComponentProps, ReactNode } from "react";
import { Icon } from "./Icon.tsx";
import type { IconName } from "./icon-data.ts";
import { cx } from "./cx.ts";

export function Menu({ className, ...rest }: ComponentProps<"div">) {
  return <div role="menu" className={cx("ad ad-menu", className)} {...rest} />;
}

export type MenuItemProps = Omit<ComponentProps<"button">, "children"> & {
  icon?: IconName;
  /** Right-aligned hint such as a shortcut. */
  hint?: ReactNode;
  checked?: boolean;
  children: ReactNode;
};

export function MenuItem({ icon, hint, checked, className, children, type = "button", ...rest }: MenuItemProps) {
  return (
    <button type={type} role={checked === undefined ? "menuitem" : "menuitemcheckbox"} aria-checked={checked} className={cx("ad-menuitem", className)} {...rest}>
      {icon && <Icon name={icon} />}
      {children}
      {hint && <span className="ad-menuitem__hint">{hint}</span>}
    </button>
  );
}
