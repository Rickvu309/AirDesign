import type { AirDesignComponentProps } from "../types.ts";

export function SquareButton({
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
    "height": "24px",
    "justifyContent": "center",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "24px",
    "borderRadius": "3px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-current="false" aria-label="Square" type="button" className={className}>
                  <span style={{
      "alignItems": "center",
      "display": "flex",
      "filter": "drop-shadow(rgba(0, 0, 0, 0.3) 0px 0px 0.5px) drop-shadow(rgba(0, 0, 0, 0.15) 0px 1px 3px)",
      "height": "24px",
      "justifyContent": "center",
      "scale": "1",
      "transform": "matrix(0.75, 0, 0, 0.75, 0, 0)",
      "transformOrigin": "12px 12px",
      "width": "24px"
    }}>
  <svg style={{
        "display": "block",
        "height": "24px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "24px",
        "fill": "rgb(61, 56, 245)",
        "stroke": "rgb(43, 39, 172)",
        "strokeWidth": "2px"
      }} width="24" height="24" viewBox="0 0 24 24">
    <rect style={{
          "strokeOpacity": "0.9"
        }} width="23" height="23" x=".5" y=".5" strokeOpacity=".9" rx="2.38"></rect>
  </svg>
</span>
                </button>;
}
