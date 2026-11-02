import type { AirDesignProps } from "../types.ts";

export function ChevronDownBlueIcon({
  style,
  className,
  ...rest
}: AirDesignProps<"svg">) {
  return <svg style={{
    "display": "block",
    "height": "16px",
    "marginRight": "2px",
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
  }} width="16" height="16" fill="none" viewBox="0 0 16 16" aria-hidden="true" className={className} {...rest}>
              <path style={{
      "fill": "var(--ad-selection-strong, rgb(0, 123, 229))"
    }} d="M9.768 6.768a.5.5 0 0 1 .707.707l-2.12 2.121a.5.5 0 0 1-.708 0L5.525 7.475a.5.5 0 0 1 .708-.707l1.768 1.767z"></path>
            </svg>;
}
