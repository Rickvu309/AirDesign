import type { AirDesignProps } from "../types.ts";

export function ShapeSquareIcon({
  style,
  className,
  ...rest
}: AirDesignProps<"svg">) {
  return <svg style={{
    "display": "block",
    "height": "24px",
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
  }} width="24" height="24" viewBox="0 0 24 24" className={className} {...rest}>
    <rect style={{
      "strokeOpacity": "0.9"
    }} width="23" height="23" x=".5" y=".5" strokeOpacity=".9" rx="2.38"></rect>
  </svg>;
}
