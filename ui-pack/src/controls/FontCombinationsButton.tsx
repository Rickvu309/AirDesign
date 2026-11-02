import type { AirDesignComponentProps } from "../types.ts";

export function FontCombinationsButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "height": "40px",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "274px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-expanded="false" type="button" className={className}>
                  <span style={{
      "alignItems": "center",
      "display": "flex",
      "flexShrink": "0",
      "justifyItems": "center"
    }}>
  <svg style={{
        "display": "block",
        "height": "16px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "16px"
      }} width="16" height="16" fill="none" viewBox="0 0 16 16" aria-hidden="true">
    <path style={{
          "fill": "rgba(0, 0, 0, 0.3)"
        }} fill="var(--fpl-icon-color, var(--color-icon))" d="M6.768 5.525a.5.5 0 0 1 .707 0l2.121 2.121a.5.5 0 0 1 0 .707l-2.121 2.122a.5.5 0 0 1-.707-.708L8.535 8 6.768 6.232a.5.5 0 0 1 0-.707"></path>
  </svg>
</span>
                  <span style={{
      "color": "rgba(0, 0, 0, 0.5)",
      "display": "block",
      "flexBasis": "0%",
      "flexGrow": "1",
      "fontFamily": "Inter, ui-sans-serif, system-ui, -apple-system, \"system-ui\", \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, SFProLocalRange",
      "fontWeight": "550",
      "letterSpacing": "0.05504px",
      "minWidth": "0px"
    }}>
  Font combinations
</span>
                </button>;
}
