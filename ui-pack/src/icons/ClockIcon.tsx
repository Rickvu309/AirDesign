import type { AirDesignProps } from "../types.ts";

export function ClockIcon({
  style,
  className,
  ...rest
}: AirDesignProps<"svg">) {
  return <svg style={{
    "display": "block",
    "height": "24px",
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
  }} width="24" height="24" fill="none" viewBox="0 0 24 24" className={className} {...rest}>
    <path style={{
      "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
    }} fillRule="evenodd" d="M12 19a7 7 0 1 0 0-14 7 7 0 0 0 0 14m6-7a6 6 0 1 1-12 0 6 6 0 0 1 12 0m-5.5-3.5a.5.5 0 0 0-1 0V12a.5.5 0 0 0 .146.354l2 2a.5.5 0 0 0 .708-.708L12.5 11.793z" clipRule="evenodd"></path>
  </svg>;
}
