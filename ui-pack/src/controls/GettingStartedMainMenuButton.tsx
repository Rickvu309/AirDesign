import type { AirDesignComponentProps } from "../types.ts";

export function GettingStartedMainMenuButton({
  style,
  className
}: AirDesignComponentProps) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "boxSizing": "border-box",
    "color": "rgb(0, 0, 0)",
    "display": "flex",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "justifyItems": "center",
    "lineHeight": "16px",
    "textAlign": "start",
    "borderRadius": "5px",
    "padding": "4px",
    "flexShrink": 0,
    position: "relative",
    ...style
  }} aria-label="Main menu" aria-haspopup="menu" aria-expanded="false" type="button" className={className}>
    <svg style={{
      "display": "block",
      "width": 24,
      "height": 24,
      "flexShrink": 0
    }} viewBox="0 0 64 64" preserveAspectRatio="none" aria-hidden="true" width={24} height={24}>
      <path d="M13 57l19-50 19 50" fill="none" stroke="#1A1A1A" strokeWidth={3.063} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"></path>
      <path d="M6 44l52-14" fill="none" stroke="#FF58AE" strokeWidth={2.188} strokeLinecap="round" vectorEffect="non-scaling-stroke"></path>
    </svg>
  </button>;
}
