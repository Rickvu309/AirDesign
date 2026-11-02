import type { AirDesignComponentProps } from "../types.ts";

export function TrashIcon({
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
      "fill": "rgba(0, 0, 0, 0.898)"
    }} fill="var(--fpl-icon-color, var(--color-icon))" d="M16.355 9a.5.5 0 0 1 .498.52l-.273 6.563-.018.198a2 2 0 0 1-1.782 1.71l-.198.009H9.418a2 2 0 0 1-1.998-1.917l-.273-6.562a.5.5 0 1 1 1-.042l.272 6.563a1 1 0 0 0 .999.958h5.164a1 1 0 0 0 1-.958l.272-6.563a.5.5 0 0 1 .5-.479M11 10a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 1 .5-.5m2 0a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 1 .5-.5m0-5a1 1 0 0 1 1 1v1h3.5a.5.5 0 0 1 0 1h-11a.5.5 0 0 1 0-1H10V6a1 1 0 0 1 1-1zm-2 2h2V6h-2z"></path>
  </svg>;
}
