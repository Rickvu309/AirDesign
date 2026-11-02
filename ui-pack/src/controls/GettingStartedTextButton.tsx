import type { AirDesignComponentProps } from "../types.ts";

export function GettingStartedTextButton({
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
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "4px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-hidden="false" aria-label="Text" aria-pressed="false" type="button" className={className}>
                  <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
                    <path style={{
        "fill": "rgba(0, 0, 0, 0.898)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M19.5 4a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0V5h-6.5v14H15a.5.5 0 0 1 0 1H9a.5.5 0 0 1 0-1h2.5V5H5v2.5a.5.5 0 0 1-1 0v-3a.5.5 0 0 1 .5-.5z"></path>
                  </svg>
                </button>;
}
