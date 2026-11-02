import type { ComponentProps } from "react";
import { cx } from "./cx.ts";

export type DividerProps = Omit<ComponentProps<"hr">, "children"> & { orientation?: "horizontal" | "vertical" };

export function Divider({ orientation = "horizontal", className, ...rest }: DividerProps) {
  return <hr aria-orientation={orientation} className={cx("ad-divider", orientation === "horizontal" ? "ad-divider--h" : "ad-divider--v", className)} {...rest} />;
}
