import type { AirDesignProps } from "../types.ts";

export function UploadIcon({
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
    }} d="M17.5 13a.5.5 0 0 1 .5.5v3a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 16.5v-3a.5.5 0 0 1 1 0v3a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 1 .5-.5m-5.775-7.918a.5.5 0 0 1 .629.064l3.5 3.5a.5.5 0 0 1-.707.708L12.5 6.707V12.5a.5.5 0 0 1-1 0V6.707L8.854 9.354a.5.5 0 1 1-.708-.708l3.5-3.5z"></path>
          </svg>;
}
