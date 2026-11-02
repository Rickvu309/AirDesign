import type { AirDesignComponentProps } from "../types.ts";

export function TextStyleHeader2Button({
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
    "height": "40px",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "272px",
    "borderRadius": "5px",
    "padding": "12px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-label="" type="button" className={className}>
    <span style={{
      display: "flex",
      alignItems: "center",
      width: "100%",
      height: "100%",
      fontFamily: "Inter, sans-serif",
      fontSize: 20,
      fontWeight: 550,
      color: "#222222"
    }}>Header 2</span>
  </button>;
}
