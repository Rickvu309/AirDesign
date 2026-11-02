import type { AirDesignComponentProps } from "../types.ts";

export function GettingStartedMoveToolsButton2({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyContent": "center",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "16px",
    "borderRadius": "5px",
    "padding": "4px 0px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="true" aria-label="Move tools" aria-pressed="false" aria-haspopup="menu" aria-expanded="false" type="button" aria-disabled="true" className={className}>
    <span style={{
      "display": "block"
    }} aria-hidden="true">
      <svg style={{
        "display": "block",
        "height": "24px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "24px"
      }} width="24" height="24" fill="none" viewBox="0 0 24 24">
        <path style={{
          "fill": "rgba(0, 0, 0, 0.3)"
        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
      </svg>
    </span>
  </button>;
}
