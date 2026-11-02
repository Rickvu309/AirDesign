import type { AirDesignProps } from "../types.ts";

export function GettingStartedMainMenuIcon({
  style,
  className,
  ...rest
}: AirDesignProps<"svg">) {
  return <svg style={{
    "display": "block",
    "height": 24,
    "flexShrink": 0,
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    width: 24,
    ...style
  }} viewBox="0 0 64 64" preserveAspectRatio="none" aria-hidden="true" width={24} height={24} className={className} {...rest}>
      <path d="M13 57l19-50 19 50" fill="none" stroke="var(--ad-ink, #1A1A1A)" strokeWidth={3.063} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"></path>
      <path d="M6 44l52-14" fill="none" stroke="var(--ad-pink, #FF58AE)" strokeWidth={2.188} strokeLinecap="round" vectorEffect="non-scaling-stroke"></path>
    </svg>;
}
