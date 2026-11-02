import type { ComponentProps } from "react";
import { cx } from "./cx.ts";

export type BadgeProps = ComponentProps<"span"> & { tone?: "neutral" | "brand" | "info" };

export function Badge({ tone = "neutral", className, ...rest }: BadgeProps) {
  return <span className={cx("ad ad-badge", `ad-badge--${tone}`, className)} {...rest} />;
}
