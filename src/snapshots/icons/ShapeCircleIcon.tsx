import type { AirDesignProps } from "../types.js";

export function ShapeCircleIcon({
  style,
  className,
  ...rest
}: AirDesignProps<"svg">) {
  return <svg style={{
    "display": "block",
    "height": "26px",
    "overflowX": "hidden",
    "overflowY": "hidden",
    "fill": "var(--ad-accent, rgb(61, 56, 245))",
    "stroke": "var(--ad-accent-strong, rgb(43, 39, 172))",
    "strokeWidth": "2px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    flexShrink: 0,
    width: 24,
    ...style
  }} width="27" height="26" viewBox="0 0 27 26" className={className} {...rest}>
    <circle style={{
      "strokeOpacity": "0.9"
    }} cx="13.5" cy="13" r="12.458" strokeLinecap="square" strokeOpacity=".9"></circle>
  </svg>;
}
