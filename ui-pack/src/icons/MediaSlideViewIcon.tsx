import type { AirDesignComponentProps } from "../types.ts";

export function MediaSlideViewIcon({
  style,
  className
}: AirDesignComponentProps) {
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
  }} width="24" height="24" fill="none" viewBox="0 0 24 24" className={className}>
    <path style={{
      "fill": "rgba(0, 0, 0, 0.898)"
    }} fill="var(--fpl-icon-color, var(--color-icon))" d="M19.5 19a.5.5 0 0 1 0 1h-15a.5.5 0 0 1 0-1zM19 8a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM5 15h14V9H5zM19.5 4a.5.5 0 0 1 0 1h-15a.5.5 0 0 1 0-1z"></path>
  </svg>;
}
