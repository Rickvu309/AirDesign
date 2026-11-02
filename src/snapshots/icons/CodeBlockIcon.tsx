import type { AirDesignProps } from "../types.js";

export function CodeBlockIcon({
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
    }} fillRule="evenodd" d="M7.354 4.146a.5.5 0 0 1 0 .708L5.207 7l2.147 2.146a.5.5 0 1 1-.708.708l-2.5-2.5a.5.5 0 0 1 0-.708l2.5-2.5a.5.5 0 0 1 .708 0M14 4.5a.5.5 0 0 1 .5-.5H18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6.5a.5.5 0 0 1 1 0V18a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-3.5a.5.5 0 0 1-.5-.5m-4.354.354a.5.5 0 1 1 .708-.708l2.5 2.5a.5.5 0 0 1 0 .708l-2.5 2.5a.5.5 0 0 1-.708-.708L11.793 7z" clipRule="evenodd"></path>
      </svg>;
}
