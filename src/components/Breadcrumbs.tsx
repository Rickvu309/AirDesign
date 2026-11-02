import type { ComponentProps } from "react";
import { Icon } from "../icons/Icon.js";
import { cx } from "../lib/cx.js";

export interface Crumb { label: string; href?: string }
export type BreadcrumbsProps = Omit<ComponentProps<"nav">, "children"> & { items: Crumb[] };

export function Breadcrumbs({ items, className, ...rest }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={cx("ad ad-crumbs", className)} {...rest}>
      <ol>
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={c.label + i}>
              {c.href && !last ? <a href={c.href}>{c.label}</a> : <span aria-current={last ? "page" : undefined}>{c.label}</span>}
              {!last && <Icon name="chevron-right" size={12} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
