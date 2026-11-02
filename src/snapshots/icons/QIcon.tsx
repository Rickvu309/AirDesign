import type { AirDesignProps } from "../types.js";

export function QIcon({
  style,
  className,
  ...rest
}: AirDesignProps<"svg">) {
  return <svg style={{
    "display": "block",
    "height": "40px",
    "overflowX": "hidden",
    "overflowY": "hidden",
    "minWidth": "0px",
    "minHeight": "0px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    flexShrink: 0,
    width: 24,
    ...style
  }} viewBox="0 0 30 40" aria-hidden="true" className={className} {...rest}>
          <circle style={{
      "stroke": "var(--ad-brand, rgb(255, 92, 22))",
      "strokeWidth": "2px",
      "strokeDasharray": "400px",
      "strokeDashoffset": "400px"
    }} cx="15" cy="20" r="13" fill="none" stroke="var(--color-bg-brand)" strokeWidth="2"></circle>
        </svg>;
}
