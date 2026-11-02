import type { AirDesignComponentProps } from "../types.ts";

export function MoveVIcon({
  style,
  className
}: AirDesignComponentProps) {
  return <svg style={{
    "display": "block",
    "height": "16px",
    "marginBottom": "-4px",
    "marginRight": "4px",
    "marginTop": "-4px",
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
      "fill": "rgb(255, 255, 255)"
    }} fill="var(--fpl-icon-color, var(--color-icon))" d="M11.584 3.723a.5.5 0 0 1 .832.554l-5 7.5a.502.502 0 0 1-.77.077l-3-3a.5.5 0 0 1 .708-.708l2.568 2.569z"></path>
            </svg>;
}
