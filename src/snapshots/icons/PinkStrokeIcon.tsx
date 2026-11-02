import type { AirDesignProps } from "../types.js";

export function PinkStrokeIcon({
  style,
  className,
  ...rest
}: AirDesignProps<"svg">) {
  return <svg style={{
    "display": "block",
    "height": "28px",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    flexShrink: 0,
    width: 24,
    ...style
  }} viewBox="0 0 64 64" preserveAspectRatio="none" aria-hidden="true" className={className} {...rest}>
    <path style={{
      "stroke": "var(--ad-pink, rgb(255, 88, 174))",
      "strokeWidth": "2.188px"
    }} d="M6 44l52-14" fill="none" stroke="var(--ad-pink, #FF58AE)" strokeWidth="2.188" strokeLinecap="round" vectorEffect="non-scaling-stroke"></path>
  </svg>;
}
