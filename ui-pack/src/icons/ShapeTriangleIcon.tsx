import type { AirDesignComponentProps } from "../types.ts";

export function ShapeTriangleIcon({
  style,
  className
}: AirDesignComponentProps) {
  return <svg style={{
    "display": "block",
    "height": "25px",
    "overflowX": "hidden",
    "overflowY": "hidden",
    "fill": "rgb(61, 56, 245)",
    "stroke": "rgb(43, 39, 172)",
    "strokeWidth": "2px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    flexShrink: 0,
    width: 24,
    ...style
  }} width="28" height="25" viewBox="0 0 28 25" className={className}>
      <path style={{
      "strokeOpacity": "0.9"
    }} stroke="#000" strokeLinejoin="round" strokeOpacity=".9" d="M12.93 1.912c.444-.77 1.554-.77 1.998 0L26.786 22.45c.444.77-.11 1.731-1 1.731H2.072c-.888 0-1.443-.962-1-1.73z"></path>
    </svg>;
}
