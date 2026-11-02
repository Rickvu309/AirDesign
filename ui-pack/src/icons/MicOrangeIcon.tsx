import type { AirDesignComponentProps } from "../types.ts";

export function MicOrangeIcon({
  style,
  className
}: AirDesignComponentProps) {
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
  }} width="24" height="24" fill="none" viewBox="0 0 24 24" className={className}>
          <path style={{
      "fill": "rgb(226, 76, 12)"
    }} fill="var(--fpl-icon-color, var(--color-icon))" d="M16.5 11.5a.5.5 0 0 1 .5.5 5 5 0 0 1-4.5 4.975V18h2a.5.5 0 0 1 0 1h-5a.5.5 0 0 1 0-1h2v-1.025A5 5 0 0 1 7 12a.5.5 0 0 1 1 0 4 4 0 0 0 8 0 .5.5 0 0 1 .5-.5M12 5a3 3 0 0 1 3 3v4l-.004.154a3 3 0 0 1-5.992 0L9 12V8a3 3 0 0 1 3-3m0 1a2 2 0 0 0-2 2v4a2 2 0 1 0 4 0V8a2 2 0 0 0-2-2"></path>
        </svg>;
}
