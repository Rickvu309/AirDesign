import type { AirDesignComponentProps } from "../types.ts";

export function TriangleButton({
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
  }} aria-current="false" aria-label="Triangle" type="button" className={className}>
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
        "height": "25px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "24px",
        "fill": "rgb(61, 56, 245)",
        "stroke": "rgb(43, 39, 172)",
        "strokeWidth": "2px"
      }} width="28" height="25" viewBox="0 0 28 25">
      <path style={{
          "strokeOpacity": "0.9"
        }} stroke="#000" strokeLinejoin="round" strokeOpacity=".9" d="M12.93 1.912c.444-.77 1.554-.77 1.998 0L26.786 22.45c.444.77-.11 1.731-1 1.731H2.072c-.888 0-1.443-.962-1-1.73z"></path>
    </svg>
  </span>
</button>;
}
