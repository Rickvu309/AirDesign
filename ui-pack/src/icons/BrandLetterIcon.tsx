import type { AirDesignProps } from "../types.ts";

export function BrandLetterIcon({
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
      "stroke": "rgb(26, 26, 26)",
      "strokeWidth": "3.063px"
    }} d="M13 57l19-50 19 50" fill="none" stroke="var(--ad-ink, #1A1A1A)" strokeWidth="3.063" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"></path>
  </svg>;
}
