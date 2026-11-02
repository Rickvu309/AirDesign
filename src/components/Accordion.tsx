import type { ComponentProps, ReactNode } from "react";
import { Icon } from "../icons/Icon.js";
import { cx } from "../lib/cx.js";

export function Accordion({ className, ...rest }: ComponentProps<"div">) {
  return <div className={cx("ad ad-accordion", className)} {...rest} />;
}

export type AccordionItemProps = Omit<ComponentProps<"details">, "title"> & { title: ReactNode; defaultOpen?: boolean };

/** Native details/summary: keyboard, find-in-page and no-JS behaviour included. */
export function AccordionItem({ title, defaultOpen, className, children, ...rest }: AccordionItemProps) {
  return (
    <details className={cx("ad-accordion__item", className)} open={defaultOpen} {...rest}>
      <summary className="ad-accordion__summary">
        <span>{title}</span>
        <Icon name="chevron-down" className="ad-accordion__chevron" />
      </summary>
      <div className="ad-accordion__panel">{children}</div>
    </details>
  );
}
