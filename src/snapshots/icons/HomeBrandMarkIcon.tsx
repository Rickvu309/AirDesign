import type { AirDesignProps } from "../types.js";

export function HomeBrandMarkIcon({
  style,
  className,
  ...rest
}: AirDesignProps<"svg">) {
  return <svg style={{
    "display": "block",
    "height": "16px",
    "overflowX": "hidden",
    "overflowY": "hidden",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    flexShrink: 0,
    width: 24,
    ...style
  }} width="16" height="16" fill="none" viewBox="0 0 64 64" className={className} {...rest}><path d="M13 57l19-50 19 50" fill="none" stroke="var(--ad-ink, #1A1A1A)" strokeWidth={3.063} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /><path d="M6 44l52-14" fill="none" stroke="var(--ad-pink, #FF58AE)" strokeWidth={2.188} strokeLinecap="round" vectorEffect="non-scaling-stroke" /></svg>;
}
