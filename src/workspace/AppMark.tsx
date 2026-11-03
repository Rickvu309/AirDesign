import type { ComponentProps } from "react";
import { cx } from "../lib/cx.js";

export type AppMarkProps = ComponentProps<"div"> & {
  size?: number;
};

export function AppMark({ size = 24, className, style, ...rest }: AppMarkProps) {
  return (
    <div
      className={cx("ad-app-mark", className)}
      style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", ...style }}
      {...rest}
    >
      <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="AirDesign">
        <path d="M13 57l19-50 19 50" fill="none" stroke="currentColor" strokeWidth={3.063} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6 44l52-14" fill="none" stroke="var(--ad-pink, #FF58AE)" strokeWidth={2.188} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
      </svg>
    </div>
  );
}
