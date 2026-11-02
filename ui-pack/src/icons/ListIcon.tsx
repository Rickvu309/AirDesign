import type { AirDesignProps } from "../types.ts";

export function ListIcon({
  style,
  className,
  ...rest
}: AirDesignProps<"svg">) {
  return <svg style={{
    "display": "block",
    "height": "24px",
    "overflowX": "hidden",
    "overflowY": "hidden",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    flexShrink: 0,
    width: 24,
    ...style
  }} width="24" height="24" fill="none" viewBox="0 0 24 24" className={className} {...rest}>
                  <path style={{
      "fill": "var(--ad-ink-muted, rgba(0, 0, 0, 0.5))"
    }} d="M7 16a1 1 0 1 1 0 2 1 1 0 0 1 0-2m10.5.5a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1zM7 11a1 1 0 1 1 0 2 1 1 0 0 1 0-2m10.5.5a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1zM7 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2m10.5.5a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1z"></path>
                </svg>;
}
