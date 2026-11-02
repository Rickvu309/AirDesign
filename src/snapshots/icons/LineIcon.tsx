import type { AirDesignProps } from "../types.js";

export function LineIcon({
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
    }} fillRule="evenodd" d="M19.854 4.146a.5.5 0 0 1 0 .708l-15 15a.5.5 0 0 1-.708-.708l15-15a.5.5 0 0 1 .708 0" clipRule="evenodd"></path>
            </svg>;
}
