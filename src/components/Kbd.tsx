import type { ComponentProps } from "react";
import { cx } from "../lib/cx.js";

export function Kbd({ className, ...rest }: ComponentProps<"kbd">) {
  return <kbd className={cx("ad ad-kbd", className)} {...rest} />;
}
