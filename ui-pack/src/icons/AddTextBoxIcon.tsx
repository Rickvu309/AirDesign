import type { AirDesignComponentProps } from "../types.ts";

export function AddTextBoxIcon({
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
    }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M6 6.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 .5.5V9a.5.5 0 0 1-1 0V7h-4.5v10h2a.5.5 0 0 1 0 1h-5a.5.5 0 0 1 0-1h2V7H7v2a.5.5 0 0 1-1 0z" clipRule="evenodd"></path>
                </svg>;
}
