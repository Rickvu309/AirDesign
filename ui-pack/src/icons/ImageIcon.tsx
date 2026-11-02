import type { AirDesignComponentProps } from "../types.ts";

export function ImageIcon({
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
      "fill": "rgba(0, 0, 0, 0.5)"
    }} fill="var(--fpl-icon-color, var(--color-icon))" d="M16 6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM8 7a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1zm2.225 4.082a.5.5 0 0 1 .629.064l4 4a.5.5 0 1 1-.707.707L10.5 12.208l-1.646 1.646a.5.5 0 1 1-.708-.707l2-2zM14.5 8a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3m0 1a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1"></path>
    </svg>;
}
