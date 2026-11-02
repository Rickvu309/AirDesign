import type { AirDesignComponentProps } from "../types.ts";

export function TextChevronDownMutedIcon({
  style,
  className
}: AirDesignComponentProps) {
  return <svg style={{
    "display": "block",
    "height": "16px",
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
  }} width="16" height="16" fill="none" viewBox="0 0 16 16" aria-hidden="true" className={className}>
    <path style={{
      "fill": "rgba(0, 0, 0, 0.3)"
    }} fill="var(--fpl-icon-color, var(--color-icon))" d="M9.768 6.768a.5.5 0 0 1 .707.707l-2.12 2.121a.5.5 0 0 1-.708 0L5.525 7.475a.5.5 0 0 1 .708-.707l1.768 1.767z"></path>
  </svg>;
}
