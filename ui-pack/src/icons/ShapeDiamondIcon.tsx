import type { AirDesignComponentProps } from "../types.ts";

export function ShapeDiamondIcon({
  style,
  className
}: AirDesignComponentProps) {
  return <svg style={{
    "display": "block",
    "height": "30px",
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
  }} width="29" height="30" viewBox="0 0 29 30" className={className}>
    <rect style={{
      "strokeOpacity": "0.9"
    }} width="21" height="21" x="-.383" y="15.106" strokeOpacity=".9" rx="2.556" transform="rotate(-45 -.383 15.106)"></rect>
  </svg>;
}
