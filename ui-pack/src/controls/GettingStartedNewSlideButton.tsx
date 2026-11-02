import type { AirDesignComponentProps } from "../types.ts";

export function GettingStartedNewSlideButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgb(255, 255, 255)",
    "borderBottomColor": "rgb(230, 230, 230)",
    "borderBottomLeftRadius": "6px",
    "borderBottomStyle": "solid",
    "borderBottomWidth": "1px",
    "borderLeftColor": "rgb(230, 230, 230)",
    "borderLeftStyle": "solid",
    "borderLeftWidth": "1px",
    "borderTopColor": "rgb(230, 230, 230)",
    "borderTopLeftRadius": "6px",
    "borderTopStyle": "solid",
    "borderTopWidth": "1px",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "height": "24px",
    "justifyContent": "center",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "padding": "0px 0px 0px 24px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-label="New slide" aria-description="Add slide from template" aria-haspopup="dialog" aria-expanded="false" type="button" className={className}>
                <p style={{
      "color": "rgb(0, 0, 0)",
      "fontFamily": "Inter, sans-serif",
      "fontSize": "11px",
      "fontWeight": "400",
      "lineHeight": "16px",
      "marginBottom": "0px",
      "marginTop": "0px",
      "whiteSpace": "nowrap"
    }}>
                  <span style={{
        "whiteSpace": "nowrap"
      }}>New slide</span>
                </p>
                <svg style={{
      "display": "block",
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
