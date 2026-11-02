import type { AirDesignProps } from "../types.js";

export function PlanIcon({
  style,
  className,
  ...rest
}: AirDesignProps<"svg">) {
  return <svg style={{
    "display": "block",
    "flexShrink": "0",
    "height": "24px",
    "overflowX": "hidden",
    "overflowY": "hidden",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    width: 24,
    ...style
  }} width="24" height="24" fill="none" viewBox="0 0 24 24" className={className} {...rest}>
                  <path style={{
      "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
    }} d="M14.147 10.647a.5.5 0 0 1 .707.707l-2.5 2.5a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1 .707-.707L12 12.793z"></path>
                </svg>;
}
