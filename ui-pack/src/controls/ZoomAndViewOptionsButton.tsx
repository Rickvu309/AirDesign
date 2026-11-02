import type { AirDesignComponentProps } from "../types.ts";

export function ZoomAndViewOptionsButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgb(255, 255, 255)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontVariant": "tabular-nums",
    "fontVariantNumeric": "tabular-nums",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "marginLeft": "1px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "4px 4px 4px 12px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-label="100%, zoom and view options" aria-haspopup="menu" aria-expanded="false" type="button" className={className}>
                  100%
                  <svg style={{
      "display": "block",
      "fontVariant": "tabular-nums",
      "height": "16px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "16px"
    }} width="16" height="16" fill="none" viewBox="0 0 16 16">
                    <path style={{
        "fill": "rgba(0, 0, 0, 0.898)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" d="M9.768 6.768a.5.5 0 0 1 .707.707l-2.12 2.121a.5.5 0 0 1-.708 0L5.525 7.475a.5.5 0 0 1 .708-.707l1.768 1.767z"></path>
                  </svg>
                </button>;
}
