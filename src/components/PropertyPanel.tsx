import type { ComponentProps, ReactNode } from "react";
import { useId } from "react";
import { cx } from "../lib/cx.js";

/** A titled group of property rows, as in an inspector. */
export function PropertySection({ title, className, children, ...rest }: Omit<ComponentProps<"section">, "title"> & { title: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cx("ad ad-props", className)} {...rest}>
      <h3 id={id} className="ad-props__title">{title}</h3>
      <div className="ad-props__rows">{children}</div>
    </section>
  );
}

/** Label on the left, control on the right. Pass the control's id as `htmlFor` for a real label. */
export function PropertyRow({ label, htmlFor, children }: { label: ReactNode; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="ad-props__row">
      <label htmlFor={htmlFor} className="ad-props__label">{label}</label>
      <div className="ad-props__control">{children}</div>
    </div>
  );
}
