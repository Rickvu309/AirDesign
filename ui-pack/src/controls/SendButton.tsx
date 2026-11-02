import type { AirDesignComponentProps } from "../types.ts";

export function SendButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgb(217, 217, 217)",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "flexShrink": "0",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "height": "24px",
    "justifyContent": "start",
    "lineHeight": "16px",
    "textAlign": "center",
    "width": "24px",
    "borderRadius": "9999px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    ...style
  }} aria-disabled="true" type="button" aria-label="Send" className={className}>
      <div style={{
      "alignItems": "center",
      "display": "flex",
      "height": "24px",
      "justifyContent": "center",
      "position": "relative",
      "width": "24px"
    }}>
        <div style={{
        "position": "absolute",
        "minWidth": "0px",
        "minHeight": "0px"
      }}>
          <svg style={{
          "display": "block",
          "flexShrink": "0",
          "height": "24px",
          "overflowX": "hidden",
          "overflowY": "hidden",
          "width": "24px"
        }} width="24" height="24" fill="none" viewBox="0 0 24 24">
            <path style={{
            "fill": "rgb(255, 255, 255)"
          }} fill="var(--fpl-icon-color, var(--color-icon))" d="M11.725 5.582a.5.5 0 0 1 .629.064l4.5 4.5a.5.5 0 1 1-.707.707L12.5 7.208V18a.5.5 0 0 1-1 0V7.207l-3.646 3.647a.5.5 0 1 1-.708-.707l4.5-4.5z"></path>
          </svg>
        </div>
      </div>
    </button>;
}
