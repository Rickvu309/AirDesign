import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx.ts";

export type CardProps = ComponentProps<"article"> & {
  /** Media area (image, thumbnail) above the text. */
  media?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  interactive?: boolean;
};

export function Card({ media, title, meta, interactive, className, children, ...rest }: CardProps) {
  return (
    <article className={cx("ad ad-card", interactive && "ad-card--interactive", className)} {...rest}>
      {media}
      <div className="ad-card__body">
        <div className="ad-card__title">{title}</div>
        {meta && <div className="ad-card__meta">{meta}</div>}
        {children}
      </div>
    </article>
  );
}
