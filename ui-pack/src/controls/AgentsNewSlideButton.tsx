import type { AirDesignComponentProps } from "../types.ts";

export function AgentsNewSlideButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgb(255, 255, 255)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "height": "28px",
    "justifyContent": "center",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "width": "48px",
    "border": "1px solid rgba(0, 0, 0, 0.1)",
    "borderRadius": "2px",
    "padding": "0px",
    position: "relative",
    flexShrink: 0,
    ...style
  }} aria-label="New slide" type="button" className={className}>
  <svg style={{
      "display": "block",
      "height": "24px",
      "overflowX": "hidden",
      "overflowY": "hidden",
      "width": "24px"
    }} width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path style={{
        "fill": "rgba(0, 0, 0, 0.898)"
      }} fill="var(--fpl-icon-color, var(--color-icon))" fillRule="evenodd" d="M12 6a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 12 6" clipRule="evenodd"></path>
  </svg>
</button>;
}
